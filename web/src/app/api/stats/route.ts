import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildStats } from "@/lib/stats";

export async function GET() {
  const rows = await prisma.timelineEntry.findMany({
    where: { isRemoved: false },
    select: {
      applicationDate: true,
      biometricDate: true,
      approvalDate: true,
      sourceType: true,
    },
  });

  const payload = buildStats(rows);
  return NextResponse.json(payload);
}
