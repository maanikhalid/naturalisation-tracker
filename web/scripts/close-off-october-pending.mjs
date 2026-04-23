#!/usr/bin/env node
/**
 * Close off 90% of pending October 2025 applications by assigning:
 * - approvalDate in range 2026-02-01 .. 2026-04-30
 * - ceremonyDate 2-14 days after approvalDate
 * - status = APPROVED
 *
 * Backup:
 * - In apply mode, writes a JSON backup of original values for exact undo.
 *
 * Usage (from web/):
 *   node scripts/close-off-october-pending.mjs --dry-run
 *   node scripts/close-off-october-pending.mjs --apply
 */

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const TARGET_YEAR = 2025;
const TARGET_MONTH = 10; // October
const TARGET_RATIO = 0.9;
const APPROVAL_START = "2026-02-01";
const APPROVAL_END = "2026-04-30";

function hasFlag(flag) {
  return process.argv.includes(flag);
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

function timestampForFile() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mi = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}Z`;
}

async function main() {
  const dryRun = hasFlag("--dry-run") || !hasFlag("--apply");
  const apply = hasFlag("--apply");
  if (apply && hasFlag("--dry-run")) {
    console.error("Use either --dry-run or --apply, not both.");
    process.exit(1);
  }

  const approvalStart = parseIsoDayUtc(APPROVAL_START);
  const approvalEnd = parseIsoDayUtc(APPROVAL_END);
  if (!approvalStart || !approvalEnd || approvalStart.getTime() > approvalEnd.getTime()) {
    console.error("Invalid configured approval date range.");
    process.exit(1);
  }

  const backupDir = path.resolve(process.cwd(), "scripts/backups");
  const monthStart = new Date(Date.UTC(TARGET_YEAR, TARGET_MONTH - 1, 1));
  const monthEndExclusive = new Date(Date.UTC(TARGET_YEAR, TARGET_MONTH, 1));

  const prisma = new PrismaClient();
  try {
    const pendingOctober = await prisma.timelineEntry.findMany({
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
        username: true,
        applicationDate: true,
        approvalDate: true,
        ceremonyDate: true,
        status: true,
        sourceType: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const pendingCount = pendingOctober.length;
    const targetCount = Math.floor(pendingCount * TARGET_RATIO);
    const selected = shuffle(pendingOctober).slice(0, targetCount);

    const planned = selected.map((row) => {
      const approvalDate = randomDateBetweenUtc(approvalStart, approvalEnd);
      const ceremonyOffsetDays = randomIntInclusive(2, 14);
      const ceremonyDate = addDaysUtc(approvalDate, ceremonyOffsetDays);
      return {
        id: row.id,
        sourceType: row.sourceType,
        username: row.username,
        applicationDate: row.applicationDate.toISOString().slice(0, 10),
        newApprovalDate: approvalDate.toISOString().slice(0, 10),
        newCeremonyDate: ceremonyDate.toISOString().slice(0, 10),
        newStatus: "APPROVED",
      };
    });

    let backupPath = null;
    if (apply) {
      fs.mkdirSync(backupDir, { recursive: true });
      const stamp = timestampForFile();
      backupPath = path.join(backupDir, `oct-2025-closeoff-backup-${stamp}.json`);

      const backupPayload = {
        kind: "october-2025-closeoff-backup",
        createdAt: new Date().toISOString(),
        rules: {
          targetYear: TARGET_YEAR,
          targetMonth: TARGET_MONTH,
          ratio: TARGET_RATIO,
          approvalStart: APPROVAL_START,
          approvalEnd: APPROVAL_END,
          ceremonyOffsetDays: "2-14",
          sources: "both",
        },
        rows: selected.map((row) => ({
          id: row.id,
          oldApprovalDate: row.approvalDate ? row.approvalDate.toISOString() : null,
          oldCeremonyDate: row.ceremonyDate ? row.ceremonyDate.toISOString() : null,
          oldStatus: row.status,
        })),
      };
      fs.writeFileSync(backupPath, JSON.stringify(backupPayload, null, 2), "utf8");

      for (const row of planned) {
        await prisma.timelineEntry.update({
          where: { id: row.id },
          data: {
            approvalDate: parseIsoDayUtc(row.newApprovalDate),
            ceremonyDate: parseIsoDayUtc(row.newCeremonyDate),
            status: "APPROVED",
          },
        });
      }
    }

    const websitePending = pendingOctober.filter((r) => r.sourceType === "WEBSITE").length;
    const redditPending = pendingOctober.filter((r) => r.sourceType === "REDDIT").length;

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          target: {
            year: TARGET_YEAR,
            month: TARGET_MONTH,
            ratio: TARGET_RATIO,
            approvalStart: APPROVAL_START,
            approvalEnd: APPROVAL_END,
            ceremonyOffsetDays: "2-14",
            sources: "both",
          },
          counts: {
            pendingOctoberTotal: pendingCount,
            pendingOctoberWebsite: websitePending,
            pendingOctoberReddit: redditPending,
            selectedForClosure: targetCount,
            unchangedPendingAfterRun: pendingCount - targetCount,
          },
          backupPath,
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
