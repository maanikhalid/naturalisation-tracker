#!/usr/bin/env node
/**
 * Close off a percentage of pending November applications by assigning:
 * - approvalDate in a configured range
 * - ceremonyDate 2-14 days after approvalDate
 * - status = APPROVED
 *
 * Defaults requested by user:
 * - target month: November 2025
 * - approval range: 2026-03-29 .. 2026-04-23
 * - close ratio: 90%
 *
 * Usage (from web/):
 *   node scripts/close-off-november-pending.mjs --dry-run
 *   node scripts/close-off-november-pending.mjs --apply
 *
 * Optional overrides:
 *   --year 2025
 *   --month 11
 *   --ratio 0.9
 *   --approval-start 2026-03-29
 *   --approval-end 2026-04-23
 */

import { PrismaClient } from "@prisma/client";

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function argValue(name) {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

function parseIsoDayUtc(iso) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function addDaysUtc(d, days) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days)
  );
}

function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDateBetweenUtc(start, end) {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const randomMs = randomIntInclusive(startMs, endMs);
  const d = new Date(randomMs);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function shuffle(array) {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function main() {
  const dryRun = hasFlag("--dry-run") || !hasFlag("--apply");
  const apply = hasFlag("--apply");
  if (apply && hasFlag("--dry-run")) {
    console.error("Use either --dry-run or --apply, not both.");
    process.exit(1);
  }

  const year = Number(argValue("--year") ?? "2025");
  const month = Number(argValue("--month") ?? "11");
  const ratio = Number(argValue("--ratio") ?? "0.9");
  const approvalStartIso = argValue("--approval-start") ?? "2026-03-29";
  const approvalEndIso = argValue("--approval-end") ?? "2026-04-23";

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    console.error("Invalid --year. Expected an integer in a sane range.");
    process.exit(1);
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    console.error("Invalid --month. Expected 1-12.");
    process.exit(1);
  }
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1) {
    console.error("Invalid --ratio. Expected number in (0, 1].");
    process.exit(1);
  }

  const approvalStart = parseIsoDayUtc(approvalStartIso);
  const approvalEnd = parseIsoDayUtc(approvalEndIso);
  if (!approvalStart || !approvalEnd || approvalStart.getTime() > approvalEnd.getTime()) {
    console.error("Invalid approval date range. Use YYYY-MM-DD and start <= end.");
    process.exit(1);
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEndExclusive = new Date(Date.UTC(year, month, 1));

  const prisma = new PrismaClient();
  try {
    const pendingNovember = await prisma.timelineEntry.findMany({
      where: {
        isRemoved: false,
        approvalDate: null,
        applicationDate: {
          gte: monthStart,
          lt: monthEndExclusive,
        },
      },
      select: {
        id: true,
        applicationDate: true,
        sourceType: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const pendingCount = pendingNovember.length;
    const targetCount = Math.floor(pendingCount * ratio);
    const selected = shuffle(pendingNovember).slice(0, targetCount);

    const planned = selected.map((row) => {
      const approvalDate = randomDateBetweenUtc(approvalStart, approvalEnd);
      const ceremonyOffsetDays = randomIntInclusive(2, 14);
      const ceremonyDate = addDaysUtc(approvalDate, ceremonyOffsetDays);
      return {
        id: row.id,
        sourceType: row.sourceType,
        applicationDate: row.applicationDate.toISOString().slice(0, 10),
        approvalDate: approvalDate.toISOString().slice(0, 10),
        ceremonyDate: ceremonyDate.toISOString().slice(0, 10),
        ceremonyOffsetDays,
      };
    });

    if (apply) {
      for (const row of planned) {
        await prisma.timelineEntry.update({
          where: { id: row.id },
          data: {
            approvalDate: parseIsoDayUtc(row.approvalDate),
            ceremonyDate: parseIsoDayUtc(row.ceremonyDate),
            status: "APPROVED",
          },
        });
      }
    }

    const websitePending = pendingNovember.filter((r) => r.sourceType === "WEBSITE").length;
    const redditPending = pendingNovember.filter((r) => r.sourceType === "REDDIT").length;

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          target: {
            year,
            month,
            ratio,
            approvalStart: approvalStartIso,
            approvalEnd: approvalEndIso,
            ceremonyOffsetDays: "2-14",
            sources: "both",
          },
          counts: {
            pendingNovemberTotal: pendingCount,
            pendingNovemberWebsite: websitePending,
            pendingNovemberReddit: redditPending,
            selectedForClosure: targetCount,
            unchangedPendingAfterRun: pendingCount - targetCount,
          },
          sample: planned.slice(0, 20),
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
