#!/usr/bin/env node
/**
 * Validate data consistency for approved entries:
 * If approvalDate is set, receivedHomeOfficeEmail should be true.
 *
 * Usage (from web/):
 *   node scripts/check-approved-home-office-email.mjs
 */

import { PrismaClient } from "@prisma/client";

async function main() {
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
      console.log("OK: No inconsistencies found.");
      return;
    }

    console.log(
      JSON.stringify(
        {
          ok: false,
          message:
            "Found entries with approvalDate set but receivedHomeOfficeEmail=false",
          count: inconsistentEntries.length,
          rows: inconsistentEntries,
        },
        null,
        2
      )
    );

    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
