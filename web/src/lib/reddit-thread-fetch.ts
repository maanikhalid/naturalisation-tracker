import { ProxyAgent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from "undici";

type RedditThing = {
  kind?: string;
  data?: Record<string, unknown> & {
    replies?: unknown;
    body?: string;
    permalink?: string;
    id?: string;
    children?: string[];
  };
};

export type FetchedRedditComment = {
  id: string;
  body: string;
  permalink: string;
};

export type RedditThreadFetchResult =
  | {
      ok: true;
      requestUrl: string;
      httpStatus: number;
      contentType: string;
      linkId: string;
      comments: FetchedRedditComment[];
      topLevelChildCount: number;
      moreBatchesFetched: number;
      moreIdsDeferred: number;
    }
  | {
      ok: false;
      requestUrl: string;
      httpStatus: number;
      contentType: string;
      error: string;
      bodySnippet?: string;
    };

export type RedditProxyEnvSource = "REDDIT_HTTPS_PROXY" | "HTTPS_PROXY" | "HTTP_PROXY";

export function redditOutboundProxyEnv(): RedditProxyEnvSource | null {
  if (process.env.REDDIT_HTTPS_PROXY?.trim()) return "REDDIT_HTTPS_PROXY";
  if (process.env.HTTPS_PROXY?.trim()) return "HTTPS_PROXY";
  if (process.env.HTTP_PROXY?.trim()) return "HTTP_PROXY";
  return null;
}

function redditOutboundProxyUrl(): string | undefined {
  return (
    process.env.REDDIT_HTTPS_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim()
  );
}

let cachedProxyAgent: ProxyAgent | null = null;

function getProxyAgent(): ProxyAgent | null {
  const url = redditOutboundProxyUrl();
  if (!url) {
    cachedProxyAgent = null;
    return null;
  }
  if (!cachedProxyAgent) {
    cachedProxyAgent = new ProxyAgent(url);
  }
  return cachedProxyAgent;
}

async function redditFetch(url: string, init?: RequestInit): Promise<Response> {
  const agent = getProxyAgent();
  if (agent) {
    const merged: UndiciRequestInit = {
      ...(init as UndiciRequestInit | undefined),
      dispatcher: agent,
    };
    if (merged.body === null) {
      delete merged.body;
    }
    return undiciFetch(url, merged) as unknown as Response;
  }
  return fetch(url, init);
}

function getReplyChildren(replies: unknown): unknown[] | null {
  if (replies === "" || replies == null) return null;
  if (typeof replies === "object" && replies !== null && "data" in replies) {
    const data = (replies as { data?: { children?: unknown[] } }).data;
    return data?.children ?? null;
  }
  return null;
}

function walkListingChildren(
  children: unknown[],
  seenIds: Set<string>,
  out: FetchedRedditComment[],
  morePending: Set<string>
): void {
  if (!Array.isArray(children)) return;
  for (const raw of children) {
    if (!raw || typeof raw !== "object") continue;
    const thing = raw as RedditThing;
    const kind = thing.kind;

    if (kind === "more") {
      const ids = thing.data?.children;
      if (Array.isArray(ids)) {
        for (const id of ids) {
          if (typeof id === "string" && id.length > 0) morePending.add(id);
        }
      }
      continue;
    }

    if (kind !== "t1") continue;

    const data = thing.data;
    if (!data) continue;
    const id = String(data.id ?? "");
    if (!id) continue;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const body = String(data.body ?? "");
    const permalink = String(data.permalink ?? "");
    if (body && permalink) {
      out.push({ id, body, permalink });
    }

    const nested = getReplyChildren(data.replies);
    if (nested?.length) {
      walkListingChildren(nested, seenIds, out, morePending);
    }
  }
}

function parseThreadJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) {
    throw new Error("Response is not JSON (likely blocked or HTML error page).");
  }
  return JSON.parse(text) as unknown;
}

function linkIdFromPayload(payload: unknown): string | null {
  if (!Array.isArray(payload) || payload.length < 1) return null;
  const postListing = payload[0] as { data?: { children?: unknown[] } };
  const post = postListing?.data?.children?.[0] as RedditThing | undefined;
  const name = post?.data?.name;
  return typeof name === "string" && name.startsWith("t3_") ? name : null;
}

/** Same `.json` URL the sync uses (for curl checks and probes). */
export function redditThreadJsonUrl(postUrl: string): string {
  const trimmed = postUrl.trim().replace(/\/$/, "");
  const withJson = trimmed.endsWith(".json") ? trimmed : `${trimmed}.json`;
  const url = new URL(withJson);
  if (!url.searchParams.has("raw_json")) url.searchParams.set("raw_json", "1");
  if (!url.searchParams.has("limit")) url.searchParams.set("limit", "500");
  return url.toString();
}

async function postMoreChildren(
  linkId: string,
  childIds: string[],
  baseHeaders: HeadersInit
): Promise<RedditThing[]> {
  if (childIds.length === 0) return [];
  const body = new URLSearchParams({
    api_type: "json",
    link_id: linkId,
    children: childIds.join(","),
    sort: "confidence",
  });
  const h = new Headers(baseHeaders);
  h.set("Content-Type", "application/x-www-form-urlencoded");
  const res = await redditFetch("https://www.reddit.com/api/morechildren.json?raw_json=1", {
    method: "POST",
    headers: h,
    body,
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    json?: { data?: { things?: unknown[] }; errors?: unknown };
  };
  const things = json?.json?.data?.things;
  if (!Array.isArray(things)) return [];
  return things as RedditThing[];
}

/**
 * Loads top-level listing plus nested replies from the thread JSON, then expands Reddit
 * "more" placeholders in batches (same approach as the public site).
 */
export async function fetchRedditThreadComments(
  postUrl: string,
  headers: HeadersInit,
  options?: { maxMoreBatches?: number; moreBatchSize?: number; delayMs?: number }
): Promise<RedditThreadFetchResult> {
  const maxMoreBatches = options?.maxMoreBatches ?? 80;
  const moreBatchSize = options?.moreBatchSize ?? 40;
  const delayMs = options?.delayMs ?? 120;

  const jsonUrl = redditThreadJsonUrl(postUrl);
  const response = await redditFetch(jsonUrl, { headers, cache: "no-store" });
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  if (!response.ok) {
    const blockedHint =
      response.status === 403
        ? " Reddit often blocks hosting/datacenter IPs (curl may work on your laptop but return 403 on the server). Set REDDIT_HTTPS_PROXY to an HTTP(S) proxy on an unblocked network."
        : "";
    return {
      ok: false,
      requestUrl: jsonUrl,
      httpStatus: response.status,
      contentType,
      error: `HTTP ${response.status} from Reddit.${blockedHint}`,
      bodySnippet: text.slice(0, 200),
    };
  }

  let payload: unknown;
  try {
    payload = parseThreadJson(text);
  } catch (e) {
    return {
      ok: false,
      requestUrl: jsonUrl,
      httpStatus: response.status,
      contentType,
      error: e instanceof Error ? e.message : "Invalid JSON from Reddit",
      bodySnippet: text.slice(0, 200),
    };
  }

  const linkId = linkIdFromPayload(payload);
  if (!linkId) {
    return {
      ok: false,
      requestUrl: jsonUrl,
      httpStatus: response.status,
      contentType,
      error: "Could not read submission id (t3_) from Reddit payload.",
      bodySnippet: text.slice(0, 200),
    };
  }

  const commentListing = Array.isArray(payload) ? (payload[1] as { data?: { children?: unknown[] } }) : null;
  const topChildren = commentListing?.data?.children ?? [];
  const seenIds = new Set<string>();
  const comments: FetchedRedditComment[] = [];
  const morePending = new Set<string>();

  walkListingChildren(topChildren, seenIds, comments, morePending);

  let moreBatchesFetched = 0;

  while (morePending.size > 0 && moreBatchesFetched < maxMoreBatches) {
    const batch = Array.from(morePending).slice(0, moreBatchSize);
    for (const id of batch) morePending.delete(id);
    if (batch.length === 0) break;

    const things = await postMoreChildren(linkId, batch, headers);
    moreBatchesFetched += 1;

    walkListingChildren(things as unknown[], seenIds, comments, morePending);

    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return {
    ok: true,
    requestUrl: jsonUrl,
    httpStatus: response.status,
    contentType,
    linkId,
    comments,
    topLevelChildCount: topChildren.length,
    moreBatchesFetched,
    moreIdsDeferred: morePending.size,
  };
}
