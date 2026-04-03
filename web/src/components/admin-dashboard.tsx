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
    const data = await response.json();
    setMessage(response.ok ? `Imported ${data.imported} entries.` : "Reddit sync failed.");
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
            <li key={c.id}>
              {c.postUrl} - every {c.syncIntervalMins} mins -{" "}
              {c.active ? "active" : "inactive"} - last sync:{" "}
              {c.lastSyncedAt ? new Date(c.lastSyncedAt).toLocaleString("en-GB") : "never"}
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
