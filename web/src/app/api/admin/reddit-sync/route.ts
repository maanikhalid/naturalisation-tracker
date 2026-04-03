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

type SyncBody = { probeOnly?: boolean; postUrl?: string };

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let probeOnly = false;
  let explicitPostUrl: string | undefined;
  try {
    const ct = request.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const body = (await request.json()) as SyncBody;
      probeOnly = Boolean(body?.probeOnly);
      if (typeof body?.postUrl === "string" && body.postUrl.trim().length > 0) {
        explicitPostUrl = body.postUrl.trim();
      }
    }
  } catch {
    // empty or invalid JSON body is fine for legacy clients
  }

  if (explicitPostUrl && !explicitPostUrl.includes("reddit.com")) {
    return NextResponse.json(
      { error: "postUrl must be a reddit.com thread URL when provided." },
      { status: 400 }
    );
  }

  if (explicitPostUrl && !probeOnly) {
    return NextResponse.json(
      { error: "postUrl is only allowed together with probeOnly: true." },
      { status: 400 }
    );
  }

  const dbConfigs = await prisma.redditTrackingConfig.findMany({ where: { active: true } });
  const configs = explicitPostUrl
    ? [{ id: "__probe__", postUrl: explicitPostUrl }]
    : dbConfigs.map((c) => ({ id: c.id, postUrl: c.postUrl }));

  if (configs.length === 0) {
    return NextResponse.json(
      {
        error:
          "No active Reddit threads. Add one in admin, or POST { probeOnly: true, postUrl: \"https://www.reddit.com/...\" } to test a URL.",
      },
      { status: 400 }
    );
  }

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
          requestUrl: result.requestUrl,
          error: result.error,
          httpStatus: result.httpStatus,
          contentType: result.contentType,
          bodySnippet: result.bodySnippet,
        });
        console.error("Reddit thread fetch failed", config.postUrl, result.error, result.bodySnippet);
        continue;
      }

      const sampleComments = result.comments.slice(0, 3).map((c) => ({
        id: c.id,
        permalink: c.permalink,
        preview: c.body.replace(/\s+/g, " ").slice(0, 220),
      }));

      let threadImported = 0;
      let matchedTimeline = 0;
      let skippedDuplicate = 0;
      let parseReady = 0;

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

        parseReady += 1;

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
        if (existing) {
          skippedDuplicate += 1;
          continue;
        }

        if (probeOnly) {
          threadImported += 1;
          imported += 1;
          continue;
        }

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

      if (!probeOnly && config.id !== "__probe__") {
        await prisma.redditTrackingConfig.update({
          where: { id: config.id },
          data: { lastSyncedAt: new Date() },
        });
      }

      threads.push({
        postUrl: config.postUrl,
        ok: true,
        probeOnly,
        requestUrl: result.requestUrl,
        httpStatus: result.httpStatus,
        contentType: result.contentType,
        linkId: result.linkId,
        topLevelChildCount: result.topLevelChildCount,
        commentsLoaded: result.comments.length,
        commentsMatchingTimeline: matchedTimeline,
        commentsWithParsableDates: parseReady,
        skippedAlreadyInDatabase: skippedDuplicate,
        imported: threadImported,
        moreBatchesFetched: result.moreBatchesFetched,
        moreIdsDeferred: result.moreIdsDeferred,
        sampleComments,
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
    probeOnly,
    imported: probeOnly ? null : imported,
    wouldImport: probeOnly ? imported : null,
    threads,
    limits: { maxMoreBatches, moreBatchSize, delayMs },
    hint:
      "If wouldImport/imported is 0 but commentsLoaded > 0, see skippedAlreadyInDatabase (already stored) or commentsMatchingTimeline (text format). Test fetch: POST { probeOnly: true }.",
  });
}
