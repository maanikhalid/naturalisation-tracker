import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchRedditThreadComments } from "@/lib/reddit-thread-fetch";

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

function normaliseTimelineLine(line: string): string {
  return line
    .replace(/\*+/g, " ")
    .replace(/^[\s>*-]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function lineWithMilestoneDate(lines: string[], patterns: RegExp[]): string | null {
  const normalised = lines.map((l) => normaliseTimelineLine(l));
  for (const line of normalised) {
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

  const maxMoreBatches = (() => {
    const raw = process.env.REDDIT_SYNC_MAX_MORE_BATCHES;
    if (raw === undefined || raw === "") return 80;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return 80;
    return Math.min(500, Math.max(0, n));
  })();
  const moreBatchSize = (() => {
    const raw = process.env.REDDIT_SYNC_MORE_BATCH_SIZE;
    if (raw === undefined || raw === "") return 40;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return 40;
    return Math.min(100, Math.max(1, n));
  })();
  const delayMs = (() => {
    const raw = process.env.REDDIT_SYNC_DELAY_MS;
    if (raw === undefined || raw === "") return 120;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return 120;
    return Math.min(5000, Math.max(0, n));
  })();

  const threads: Array<Record<string, unknown>> = [];

  for (const config of configs) {
    try {
      const headers = redditFetchHeaders();
      const result = await fetchRedditThreadComments(config.postUrl, headers, {
        maxMoreBatches,
        moreBatchSize,
        delayMs,
      });

      if (!result.ok) {
        threads.push({
          postUrl: config.postUrl,
          ok: false,
          error: result.error,
          httpStatus: result.httpStatus,
          contentType: result.contentType,
          bodySnippet: result.bodySnippet,
        });
        console.error("Reddit thread fetch failed", config.postUrl, result.error, result.bodySnippet);
        continue;
      }

      let threadImported = 0;
      let matchedTimeline = 0;

      for (const comment of result.comments) {
        const body = comment.body;
        if (!body || body === "[deleted]" || body === "[removed]") continue;

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

        matchedTimeline += 1;

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

        const permalink = comment.permalink;
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
        threadImported += 1;
        imported += 1;
      }

      await prisma.redditTrackingConfig.update({
        where: { id: config.id },
        data: { lastSyncedAt: new Date() },
      });

      threads.push({
        postUrl: config.postUrl,
        ok: true,
        httpStatus: result.httpStatus,
        contentType: result.contentType,
        linkId: result.linkId,
        topLevelChildCount: result.topLevelChildCount,
        commentsLoaded: result.comments.length,
        commentsMatchingTimeline: matchedTimeline,
        imported: threadImported,
        moreBatchesFetched: result.moreBatchesFetched,
        moreIdsDeferred: result.moreIdsDeferred,
      });
    } catch (err) {
      console.error("Reddit sync thread failed", config.postUrl, err);
      threads.push({
        postUrl: config.postUrl,
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    imported,
    threads,
    limits: { maxMoreBatches, moreBatchSize, delayMs },
  });
}
