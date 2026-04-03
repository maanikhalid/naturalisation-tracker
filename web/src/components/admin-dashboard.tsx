"use client";

import { useState } from "react";

type Entry = {
  id: string;
  username: string | null;
  applicationDate: string;
  approvalDate: string | null;
  sourceType: "WEBSITE" | "REDDIT";
  isVerified: boolean;
};

type RedditConfig = {
  id: string;
  postUrl: string;
  syncIntervalMins: number;
  active: boolean;
  lastSyncedAt: string | null;
};

export function AdminDashboard({
  entries,
  configs,
}: {
  entries: Entry[];
  configs: RedditConfig[];
}) {
  const [message, setMessage] = useState("");

  async function removeEntry(id: string) {
    const reason = window.prompt("Reason for removal", "Spam / false data");
    if (!reason) return;
    const response = await fetch(`/api/admin/entries/${id}/remove`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (response.ok) window.location.reload();
  }

  async function addRedditConfig(formData: FormData) {
    const payload = {
      postUrl: String(formData.get("postUrl") ?? ""),
      syncIntervalMins: Number(formData.get("syncIntervalMins") ?? 360),
      active: Boolean(formData.get("active")),
    };
    const response = await fetch("/api/admin/reddit-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setMessage(response.ok ? "Reddit thread added." : "Could not add thread.");
    if (response.ok) window.location.reload();
  }

  type RedditSyncPayload = {
    error?: string;
    probeOnly?: boolean;
    imported?: number | null;
    wouldImport?: number | null;
    threads?: Array<{
      ok?: boolean;
      postUrl?: string;
      requestUrl?: string;
      error?: string;
      httpStatus?: number;
      contentType?: string;
      bodySnippet?: string;
      commentsLoaded?: number;
      commentsMatchingTimeline?: number;
      commentsWithParsableDates?: number;
      skippedAlreadyInDatabase?: number;
      imported?: number;
      moreBatchesFetched?: number;
      moreIdsDeferred?: number;
      sampleComments?: Array<{ id?: string; preview?: string }>;
    }>;
    limits?: { maxMoreBatches?: number; moreBatchSize?: number; delayMs?: number };
    redditOutboundProxy?: { enabled?: boolean; envVar?: string | null };
  };

  function formatRedditSyncMessage(data: RedditSyncPayload): string {
    const lines: string[] = [];
    if (data.probeOnly) {
      lines.push(`Probe only (nothing saved). Would import ${String(data.wouldImport ?? 0)} new rows.`);
    } else {
      lines.push(`Imported ${String(data.imported ?? 0)} new entries.`);
    }
    if (data.limits) {
      lines.push(
        `Limits: ${String(data.limits.maxMoreBatches)} more batches × ${String(data.limits.moreBatchSize)} ids, ${String(data.limits.delayMs)}ms delay (REDDIT_SYNC_* env).`
      );
    }
    const px = data.redditOutboundProxy;
    if (px?.enabled && px.envVar) {
      lines.push(`Reddit outbound proxy: ON (via ${px.envVar}; URL not shown).`);
    } else {
      lines.push(`Reddit outbound proxy: OFF. If the server gets HTTP 403 from Reddit, set REDDIT_HTTPS_PROXY in Plesk env and restart Node.`);
    }
    for (const t of data.threads ?? []) {
      if (t.requestUrl) {
        lines.push(`Reddit JSON URL: ${t.requestUrl}`);
      }
      if (t.ok === false) {
        lines.push(
          `Error: ${t.error ?? "unknown"} (HTTP ${String(t.httpStatus ?? "?")}, ${t.contentType ?? "no content-type"}).`
        );
        if (t.bodySnippet) {
          lines.push(`Snippet: ${t.bodySnippet.replace(/\s+/g, " ").slice(0, 160)}`);
        }
      } else {
        lines.push(
          `Loaded ${String(t.commentsLoaded ?? 0)} comments; ${String(t.commentsMatchingTimeline ?? 0)} matched timeline keywords; ${String(t.commentsWithParsableDates ?? 0)} had parsable app+bio dates; ${String(t.skippedAlreadyInDatabase ?? 0)} already in database; ${data.probeOnly ? "would import" : "imported"} ${String(t.imported ?? 0)} from this thread.`
        );
        lines.push(
          `Expanded ${String(t.moreBatchesFetched ?? 0)} "more" batches; ${String(t.moreIdsDeferred ?? 0)} ids still queued (raise REDDIT_SYNC_MAX_MORE_BATCHES if needed).`
        );
        const previews = (t.sampleComments ?? [])
          .map((s) => s.preview?.replace(/\s+/g, " ").slice(0, 100))
          .filter(Boolean);
        if (previews.length) {
          lines.push(`Sample bodies: ${previews.join(" … ")}`);
        }
      }
    }
    return lines.join("\n");
  }

  async function syncReddit() {
    setMessage("Syncing Reddit comments...");
    const response = await fetch("/api/admin/reddit-sync", { method: "POST" });
    const data = (await response.json()) as RedditSyncPayload;
    if (!response.ok) {
      setMessage(data.error ?? "Reddit sync failed.");
      return;
    }
    setMessage(formatRedditSyncMessage(data));
  }

  async function probeRedditFetch() {
    const custom = window.prompt(
      "Optional: paste a full reddit thread URL to test (or Cancel to use configured active threads only)",
      ""
    );
    setMessage("Probing Reddit fetch (no database writes)…");
    const body: { probeOnly: boolean; postUrl?: string } = { probeOnly: true };
    if (custom?.trim()) body.postUrl = custom.trim();
    const response = await fetch("/api/admin/reddit-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as RedditSyncPayload;
    if (!response.ok) {
      setMessage(data.error ?? "Probe failed.");
      return;
    }
    setMessage(formatRedditSyncMessage(data));
  }

  async function removeRedditConfig(id: string, label: string) {
    if (!window.confirm(`Remove this tracked thread from the list?\n\n${label}`)) return;
    const response = await fetch(`/api/admin/reddit-config/${id}`, { method: "DELETE" });
    setMessage(response.ok ? "Thread removed from tracking." : "Could not remove thread.");
    if (response.ok) window.location.reload();
  }

  return (
    <div>
      <section className="govuk-!-margin-bottom-9">
        <h2 className="govuk-heading-m">Reddit Tracking</h2>
        <form
          action={(formData) => {
            void addRedditConfig(formData);
          }}
          className="inline-form"
        >
          <input className="govuk-input" name="postUrl" placeholder="https://www.reddit.com/r/ukvisa/comments/..." />
          <input className="govuk-input" name="syncIntervalMins" type="number" defaultValue={360} />
          <label className="govuk-label">
            <input name="active" type="checkbox" defaultChecked /> Active
          </label>
          <button className="govuk-button govuk-button--secondary">Add thread</button>
        </form>
        <button type="button" className="govuk-button" onClick={() => void syncReddit()}>
          Run sync now
        </button>
        <button type="button" className="govuk-button govuk-button--secondary" onClick={() => void probeRedditFetch()}>
          Test fetch only (no DB writes)
        </button>
        {message && <p className="govuk-body">{message}</p>}
        <ul className="govuk-list govuk-list--bullet">
          {configs.map((c) => (
            <li key={c.id} className="govuk-!-margin-bottom-2">
              <span className="govuk-body">
                {c.postUrl} - every {c.syncIntervalMins} mins -{" "}
                {c.active ? "active" : "inactive"} - last sync:{" "}
                {c.lastSyncedAt ? new Date(c.lastSyncedAt).toLocaleString("en-GB") : "never"}
              </span>{" "}
              <button
                type="button"
                className="govuk-button govuk-button--warning govuk-!-margin-bottom-0"
                onClick={() => void removeRedditConfig(c.id, c.postUrl)}
              >
                Remove thread
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="govuk-heading-m">Latest submissions</h2>
        <div className="govuk-table__wrapper">
          <table className="govuk-table">
            <thead className="govuk-table__head">
              <tr className="govuk-table__row">
                <th className="govuk-table__header">Username</th>
                <th className="govuk-table__header">Application date</th>
                <th className="govuk-table__header">Approval date</th>
                <th className="govuk-table__header">Source</th>
                <th className="govuk-table__header">Verified</th>
                <th className="govuk-table__header">Actions</th>
              </tr>
            </thead>
            <tbody className="govuk-table__body">
              {entries.map((entry) => (
                <tr className="govuk-table__row" key={entry.id}>
                  <td className="govuk-table__cell">{entry.username ?? "-"}</td>
                  <td className="govuk-table__cell">
                    {new Date(entry.applicationDate).toLocaleDateString("en-GB")}
                  </td>
                  <td className="govuk-table__cell">
                    {entry.approvalDate
                      ? new Date(entry.approvalDate).toLocaleDateString("en-GB")
                      : "-"}
                  </td>
                  <td className="govuk-table__cell">{entry.sourceType}</td>
                  <td className="govuk-table__cell">{entry.isVerified ? "Yes" : "No"}</td>
                  <td className="govuk-table__cell">
                    <button className="govuk-button govuk-button--warning" onClick={() => void removeEntry(entry.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
