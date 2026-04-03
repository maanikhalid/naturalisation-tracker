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

  async function syncReddit() {
    setMessage("Syncing Reddit comments...");
    const response = await fetch("/api/admin/reddit-sync", { method: "POST" });
    const data = (await response.json()) as {
      imported?: number;
      threads?: Array<{
        ok?: boolean;
        postUrl?: string;
        error?: string;
        httpStatus?: number;
        contentType?: string;
        bodySnippet?: string;
        commentsLoaded?: number;
        commentsMatchingTimeline?: number;
        imported?: number;
        moreBatchesFetched?: number;
        moreIdsDeferred?: number;
      }>;
      limits?: { maxMoreBatches?: number; moreBatchSize?: number; delayMs?: number };
    };
    if (!response.ok) {
      setMessage("Reddit sync failed.");
      return;
    }
    const lines: string[] = [`Imported ${data.imported ?? 0} new entries.`];
    if (data.limits) {
      lines.push(
        `Limits: ${data.limits.maxMoreBatches} more batches × ${data.limits.moreBatchSize} ids, ${data.limits.delayMs}ms delay (set REDDIT_SYNC_* env to tune).`
      );
    }
    for (const t of data.threads ?? []) {
      if (t.ok === false) {
        lines.push(
          `Error: ${t.error ?? "unknown"} (HTTP ${String(t.httpStatus ?? "?")}, ${t.contentType ?? "no content-type"}).`
        );
        if (t.bodySnippet) {
          lines.push(`Snippet: ${t.bodySnippet.replace(/\s+/g, " ").slice(0, 160)}`);
        }
      } else {
        lines.push(
          `Loaded ${t.commentsLoaded ?? 0} comments (${t.commentsMatchingTimeline ?? 0} matched timeline text), imported ${t.imported ?? 0}; expanded ${t.moreBatchesFetched ?? 0} “more” batches, ${t.moreIdsDeferred ?? 0} ids left queued.`
        );
      }
    }
    setMessage(lines.join("\n"));
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
        <button className="govuk-button" onClick={syncReddit}>
          Run sync now
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
