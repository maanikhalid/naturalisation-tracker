#!/usr/bin/env node
/**
 * Validate/fix data consistency for approved entries:
 * If approvalDate is set, receivedHomeOfficeEmail should be true.
 *
 * Usage (from web/):
 *   node scripts/check-approved-home-office-email.mjs --dry-run
 *   node scripts/check-approved-home-office-email.mjs --apply
 */

import { PrismaClient } from "@prisma/client";

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function main() {
  const dryRun = hasFlag("--dry-run") || !hasFlag("--apply");
  const apply = hasFlag("--apply");
  if (apply && hasFlag("--dry-run")) {
    console.error("Use either --dry-run or --apply, not both.");
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const inconsistentEntries = await prisma.timelineEntry.findMany({
      where: {
        isRemoved: false,
        approvalDate: { not: null },
        receivedHomeOfficeEmail: false,
      },
      select: {
        id: true,
        username: true,
        sourceType: true,
        status: true,
        applicationDate: true,
        biometricDate: true,
        approvalDate: true,
        receivedHomeOfficeEmail: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { approvalDate: "desc" },
    });

    if (!inconsistentEntries.length) {
      console.log(
        JSON.stringify(
          {
            mode: apply ? "apply" : "dry-run",
            ok: true,
            message: "No inconsistencies found.",
            count: 0,
            updatedCount: 0,
          },
          null,
          2
        )
      );
      return;
    }

    let updatedCount = 0;
    if (apply) {
      const ids = inconsistentEntries.map((row) => row.id);
      const result = await prisma.timelineEntry.updateMany({
        where: { id: { in: ids } },
        data: { receivedHomeOfficeEmail: true },
      });
      updatedCount = result.count;
    }

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          ok: false,
          message:
            "Found entries with approvalDate set but receivedHomeOfficeEmail=false",
          count: inconsistentEntries.length,
          updatedCount,
          rows: inconsistentEntries,
        },
        null,
        2
      )
    );

    if (dryRun) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
