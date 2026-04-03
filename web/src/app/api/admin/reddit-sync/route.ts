import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

function extractDate(raw: string): Date | null {
  const match = raw.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (!match) return null;
  const dd = match[1].padStart(2, "0");
  const mm = match[2].padStart(2, "0");
  const yyyy = match[3].length === 2 ? `20${match[3]}` : match[3];
  const iso = `${yyyy}-${mm}-${dd}`;
  const d = new Date(iso);
  return Number.isNaN(d.valueOf()) ? null : d;
}

export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configs = await prisma.redditTrackingConfig.findMany({ where: { active: true } });
  let imported = 0;

  for (const config of configs) {
    try {
      const url = config.postUrl.endsWith(".json")
        ? config.postUrl
        : `${config.postUrl.replace(/\/$/, "")}.json`;

      const response = await fetch(url, {
        headers: { "User-Agent": "naturalisation-tracker-bot/0.1" },
        cache: "no-store",
      });
      if (!response.ok) continue;

      const payload = await response.json();
      const comments = payload?.[1]?.data?.children ?? [];

      for (const comment of comments) {
        const body = String(comment?.data?.body ?? "");
        if (!body) continue;

        const lines = body.split("\n").map((l: string) => l.trim().toLowerCase());
        const application = lines.find((l: string) => l.includes("application"));
        const biometric = lines.find((l: string) => l.includes("biometric"));
        const approval = lines.find((l: string) => l.includes("approval"));
        if (!application || !biometric) continue;

        const applicationDate = extractDate(application);
        const biometricDate = extractDate(biometric);
        const approvalDate = approval ? extractDate(approval) : null;
        if (!applicationDate || !biometricDate) continue;

        await prisma.timelineEntry.create({
          data: {
            applicationMethod: body.includes("post") ? "POST" : "ONLINE",
            applicationDate,
            biometricDate,
            approvalDate,
            receivedHomeOfficeEmail: body.includes("home office email"),
            status: approvalDate ? "APPROVED" : "BIOMETRICS_DONE",
            sourceType: "REDDIT",
            sourceReference: `https://reddit.com${comment?.data?.permalink ?? ""}`,
            isVerified: false,
          },
        });
        imported += 1;
      }

      await prisma.redditTrackingConfig.update({
        where: { id: config.id },
        data: { lastSyncedAt: new Date() },
      });
    } catch {
      // Keep sync resilient across multiple configured threads.
    }
  }

  return NextResponse.json({ imported });
}
