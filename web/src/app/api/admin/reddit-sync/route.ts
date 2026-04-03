import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

function redditFetchHeaders(): HeadersInit {
  const ua =
    process.env.REDDIT_USER_AGENT?.trim() ||
    "naturalisation-tracker/0.1 (UK naturalisation timeline aggregator; contact via site)";
  const headers: Record<string, string> = { "User-Agent": ua };
  const token = process.env.REDDIT_ACCESS_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

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

/** Normalise markdown bullets / bold so regex matches "**Application date:**" etc. */
function normaliseTimelineLine(line: string): string {
  return line
    .replace(/\*+/g, " ")
    .replace(/^[\s>*-]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Pick the line that actually carries the milestone date. Using the first line that merely
 * contains "application" matches headings like "Application timeline" and yields no date.
 */
function lineWithMilestoneDate(
  lines: string[],
  patterns: RegExp[]
): string | null {
  const normalised = lines.map((l) => normaliseTimelineLine(l));
  for (let i = 0; i < normalised.length; i += 1) {
    const line = normalised[i];
    if (!line) continue;
    if (!patterns.some((re) => re.test(line))) continue;
    if (extractDate(line)) return line;
  }
  return null;
}

function inferApplicationMethod(bodyLower: string, lines: string[]): "POST" | "ONLINE" {
  const methodLine = lines.map(normaliseTimelineLine).find((l) => l.includes("application method"));
  if (methodLine) {
    if (/\bonline\b/.test(methodLine)) return "ONLINE";
    if (/\bpost\b/.test(methodLine) && !/\bonline\b/.test(methodLine)) return "POST";
  }
  if (/\bapplication\s*method\s*:\s*post\b/.test(bodyLower)) return "POST";
  if (/\bapplication\s*method\s*:\s*online\b/.test(bodyLower)) return "ONLINE";
  return "ONLINE";
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
        headers: redditFetchHeaders(),
        cache: "no-store",
      });
      if (!response.ok) continue;

      const payload = await response.json();
      const comments = payload?.[1]?.data?.children ?? [];

      for (const comment of comments) {
        if (comment?.kind === "more") continue;

        const body = String(comment?.data?.body ?? "");
        if (!body) continue;

        const lines = body.split("\n");
        const bodyLower = body.toLowerCase();

        const applicationLine = lineWithMilestoneDate(lines, [
          /application\s*date/,
          /date\s*of\s*application/,
          /application\s*submitted/,
          /submitted\s*(on|:)/,
        ]);
        const biometricLine = lineWithMilestoneDate(lines, [
          /biometric\s*date/,
          /biometrics?\s*:/,
          /biometrics?\s*appointment/,
          /biometrics?\s*done/,
          /biometric\s*enrolment/,
        ]);
        if (!applicationLine || !biometricLine) continue;

        const applicationDate = extractDate(applicationLine);
        const biometricDate = extractDate(biometricLine);
        if (!applicationDate || !biometricDate) continue;

        const approvalLine = lineWithMilestoneDate(lines, [
          /approval\s*date/,
          /approved\s*on/,
          /decision\s*date/,
          /(?:^|\s)approved\s*[:\-]/,
        ]);
        const approvalDate = approvalLine ? extractDate(approvalLine) : null;

        const permalink = String(comment?.data?.permalink ?? "");
        if (!permalink) continue;
        const sourceReference = `https://reddit.com${permalink}`;
        const existing = await prisma.timelineEntry.findFirst({
          where: { sourceType: "REDDIT", sourceReference },
        });
        if (existing) continue;

        await prisma.timelineEntry.create({
          data: {
            applicationMethod: inferApplicationMethod(bodyLower, lines),
            applicationDate,
            biometricDate,
            approvalDate,
            receivedHomeOfficeEmail: bodyLower.includes("home office email"),
            status: approvalDate ? "APPROVED" : "BIOMETRICS_DONE",
            sourceType: "REDDIT",
            sourceReference,
            isVerified: false,
          },
        });
        imported += 1;
      }

      await prisma.redditTrackingConfig.update({
        where: { id: config.id },
        data: { lastSyncedAt: new Date() },
      });
    } catch (err) {
      console.error("Reddit sync thread failed", config.postUrl, err);
    }
  }

  return NextResponse.json({ imported });
}
