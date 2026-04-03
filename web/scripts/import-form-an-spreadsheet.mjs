#!/usr/bin/env node
/**
 * Import Form AN timeline rows from the Execed-style spreadsheet CSV into TimelineEntry.
 *
 * Expected columns (header row): Comment ID, Username, Application Method,
 * Application Date, Biometric Date, Approval Date, Ignore stats?, etc.
 *
 * Usage (from web/):
 *   npx prisma generate
 *   node scripts/import-form-an-spreadsheet.mjs
 *   node scripts/import-form-an-spreadsheet.mjs --dry-run
 *   node scripts/import-form-an-spreadsheet.mjs --csv "../docs/Untitled spreadsheet - Sheet1.csv"
 *
 * Env:
 *   DATABASE_URL        — required
 *   REDDIT_THREAD_POST_ID — default 1hkp9zl (ukvisa megathread)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function argValue(name) {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

const dryRun = process.argv.includes("--dry-run");
const csvPath =
  argValue("--csv") ||
  path.join(__dirname, "../../docs/Untitled spreadsheet - Sheet1.csv");
const postId = process.env.REDDIT_THREAD_POST_ID?.trim() || "1hkp9zl";
const permalinkSlug =
  process.env.REDDIT_THREAD_SLUG?.trim() ||
  "naturalisation_citizenship_application_processing";

function parseBool(s) {
  if (!s) return false;
  const t = String(s).trim().toUpperCase();
  return t === "TRUE" || t === "YES" || t === "1";
}

/** DD-MM-YYYY or DD/MM/YYYY (UK), start of day UTC */
function parseSheetDate(s) {
  if (!s) return null;
  const t = String(s).trim();
  if (/^n\/?a$/i.test(t)) return null;
  let m = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return null;
}

function inferMethod(methodRaw) {
  const m = String(methodRaw || "")
    .trim()
    .toLowerCase();
  if (!m || m === "n/a") return "ONLINE";
  if (/\bpost\b/.test(m) && !/\bonline\b/.test(m)) return "POST";
  return "ONLINE";
}

function sourceRef(commentId) {
  const id = String(commentId || "").trim();
  if (!id) return null;
  return `https://reddit.com/r/ukvisa/comments/${postId}/${permalinkSlug}/${id}/`;
}

function normaliseUsername(u) {
  if (!u) return null;
  const t = String(u).trim();
  if (!t || /^\[deleted\]$/i.test(t)) return null;
  if (t.length > 30) return t.slice(0, 30);
  return t;
}

function findHeaderRow(rows) {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    if (row.some((c) => String(c || "").trim() === "Comment ID")) return i;
  }
  return -1;
}

function rowToObject(headers, row) {
  const o = {};
  for (let j = 0; j < headers.length; j += 1) {
    const key = String(headers[j] || `_c${j}`).trim();
    o[key] = row[j] != null ? String(row[j]).trim() : "";
  }
  return o;
}

async function main() {
  if (!fs.existsSync(csvPath)) {
    console.error("CSV not found:", csvPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(csvPath, "utf8");
  const rows = parse(raw, {
    relax_column_count: true,
    skip_empty_lines: false,
  });

  const headerIdx = findHeaderRow(rows);
  if (headerIdx < 0) {
    console.error("Could not find header row containing 'Comment ID'.");
    process.exit(1);
  }

  const headers = rows[headerIdx].map((h) => String(h ?? "").trim());
  const prisma = dryRun ? null : new PrismaClient();

  let inserted = 0;
  let skippedIgnored = 0;
  let skippedInvalid = 0;
  let skippedDup = 0;
  let skippedNoId = 0;

  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.every((c) => !String(c || "").trim())) continue;

    const rec = rowToObject(headers, row);
    const commentId = rec["Comment ID"];
    if (!commentId) {
      skippedNoId += 1;
      continue;
    }

    if (parseBool(rec["Ignore stats?"])) {
      skippedIgnored += 1;
      continue;
    }

    const appD = parseSheetDate(rec["Application Date"]);
    const bioD = parseSheetDate(rec["Biometric Date"]);
    if (!appD || !bioD) {
      skippedInvalid += 1;
      continue;
    }

    const apprD = parseSheetDate(rec["Approval Date"]);
    const ref = sourceRef(commentId);
    if (!ref) {
      skippedInvalid += 1;
      continue;
    }

    if (!dryRun) {
      const existing = await prisma.timelineEntry.findFirst({
        where: { sourceType: "REDDIT", sourceReference: ref },
      });
      if (existing) {
        skippedDup += 1;
        continue;
      }

      await prisma.timelineEntry.create({
        data: {
          username: normaliseUsername(rec["Username"]),
          applicationMethod: inferMethod(rec["Application Method"]),
          applicationDate: appD,
          biometricDate: bioD,
          approvalDate: apprD,
          receivedHomeOfficeEmail: false,
          ceremonyDate: null,
          status: apprD ? "APPROVED" : "BIOMETRICS_DONE",
          sourceType: "REDDIT",
          sourceReference: ref,
          isVerified: false,
        },
      });
    }
    inserted += 1;
  }

  if (prisma) await prisma.$disconnect();

  console.log(
    JSON.stringify(
      {
        csvPath,
        dryRun,
        postId,
        ...(dryRun ? { wouldInsert: inserted } : { inserted }),
        skippedIgnored,
        skippedInvalid,
        skippedDup,
        skippedNoId,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
