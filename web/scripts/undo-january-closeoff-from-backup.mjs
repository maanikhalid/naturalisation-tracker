#!/usr/bin/env node
/**
 * Undo an apply run from close-off-january-pending.mjs using its backup JSON.
 *
 * Usage (from web/):
 *   node scripts/undo-january-closeoff-from-backup.mjs --backup "./scripts/backups/jan-2026-closeoff-backup-YYYYMMDD-HHMMSSZ.json" --dry-run
 *   node scripts/undo-january-closeoff-from-backup.mjs --backup "./scripts/backups/jan-2026-closeoff-backup-YYYYMMDD-HHMMSSZ.json" --apply
 */

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function argValue(name) {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

async function main() {
  const backupArg = argValue("--backup");
  if (!backupArg) {
    console.error("Missing required --backup path.");
    process.exit(1);
  }

  const dryRun = hasFlag("--dry-run") || !hasFlag("--apply");
  const apply = hasFlag("--apply");
  if (apply && hasFlag("--dry-run")) {
    console.error("Use either --dry-run or --apply, not both.");
    process.exit(1);
  }

  const backupPath = path.resolve(process.cwd(), backupArg);
  if (!fs.existsSync(backupPath)) {
    console.error("Backup file not found:", backupPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(backupPath, "utf8");
  const backup = JSON.parse(raw);
  if (
    !backup ||
    backup.kind !== "january-2026-closeoff-backup" ||
    !Array.isArray(backup.rows)
  ) {
    console.error("Invalid backup format for January closeoff undo.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    if (apply) {
      for (const row of backup.rows) {
        await prisma.timelineEntry.update({
          where: { id: row.id },
          data: {
            approvalDate: row.oldApprovalDate ? new Date(row.oldApprovalDate) : null,
            ceremonyDate: row.oldCeremonyDate ? new Date(row.oldCeremonyDate) : null,
            status: row.oldStatus,
          },
        });
      }
    }

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          backupPath,
          rowsInBackup: backup.rows.length,
          sample: backup.rows.slice(0, 20),
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
