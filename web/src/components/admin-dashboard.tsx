"use client";

import { useEffect, useMemo, useState } from "react";

type Entry = {
  id: string;
  username: string | null;
  applicationMethod: "ONLINE" | "POST";
  applicationDate: string;
  biometricDate: string;
  approvalDate: string | null;
  receivedHomeOfficeEmail: boolean;
  ceremonyDate: string | null;
  status:
    | "SUBMITTED"
    | "BIOMETRICS_DONE"
    | "EMAIL_RECEIVED"
    | "APPROVED"
    | "CEREMONY_PENDING"
    | "CEREMONY_DONE";
  sourceType: "WEBSITE" | "REDDIT";
  isVerified: boolean;
};

type EntryFormState = {
  username: string;
  applicationMethod: "ONLINE" | "POST";
  applicationDate: string;
  biometricDate: string;
  approvalDate: string;
  receivedHomeOfficeEmail: boolean;
  ceremonyDate: string;
  status:
    | "SUBMITTED"
    | "BIOMETRICS_DONE"
    | "EMAIL_RECEIVED"
    | "APPROVED"
    | "CEREMONY_PENDING"
    | "CEREMONY_DONE";
  sourceType: "WEBSITE" | "REDDIT";
  isVerified: boolean;
};

type AdminSortField = "applicationDate" | "biometricDate" | "approvalDate";
type SortDirection = "asc" | "desc";
type SourceFilter = "all" | "WEBSITE" | "REDDIT";
type ApprovalFilter = "all" | "approved" | "pending";
type StatusFilter = "all" | EntryFormState["status"];
type ApplicationMonthFilter = "all" | "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12";

const statusOptions: Array<{ value: EntryFormState["status"]; label: string }> = [
  { value: "SUBMITTED", label: "Submitted" },
  { value: "BIOMETRICS_DONE", label: "Biometrics done" },
  { value: "EMAIL_RECEIVED", label: "Home Office email received" },
  { value: "APPROVED", label: "Approved" },
  { value: "CEREMONY_PENDING", label: "Ceremony pending" },
  { value: "CEREMONY_DONE", label: "Ceremony done" },
];

function isoDateToInput(value: string | null): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function toFormState(entry: Entry): EntryFormState {
  return {
    username: entry.username ?? "",
    applicationMethod: entry.applicationMethod,
    applicationDate: isoDateToInput(entry.applicationDate),
    biometricDate: isoDateToInput(entry.biometricDate),
    approvalDate: isoDateToInput(entry.approvalDate),
    receivedHomeOfficeEmail: entry.receivedHomeOfficeEmail,
    ceremonyDate: isoDateToInput(entry.ceremonyDate),
    status: entry.status,
    sourceType: entry.sourceType,
    isVerified: entry.isVerified,
  };
}

function compareNullableDate(
  a: string | null,
  b: string | null,
  direction: SortDirection
) {
  const aTime = a ? new Date(a).getTime() : null;
  const bTime = b ? new Date(b).getTime() : null;
  if (aTime == null && bTime == null) return 0;
  if (aTime == null) return direction === "asc" ? 1 : -1;
  if (bTime == null) return direction === "asc" ? -1 : 1;
  return direction === "asc" ? aTime - bTime : bTime - aTime;
}

export function AdminDashboard({
  entries,
}: {
  entries: Entry[];
}) {
  const [message, setMessage] = useState("");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingState, setEditingState] = useState<EntryFormState | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [applicationMonthFilter, setApplicationMonthFilter] = useState<ApplicationMonthFilter>("all");
  const [sortField, setSortField] = useState<AdminSortField>("applicationDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [newEntry, setNewEntry] = useState<EntryFormState>({
    username: "",
    applicationMethod: "ONLINE",
    applicationDate: "",
    biometricDate: "",
    approvalDate: "",
    receivedHomeOfficeEmail: false,
    ceremonyDate: "",
    status: "SUBMITTED",
    sourceType: "WEBSITE",
    isVerified: true,
  });

  const visibleEntries = useMemo(() => {
    const filtered = entries.filter((entry) => {
      if (sourceFilter !== "all" && entry.sourceType !== sourceFilter) return false;
      if (approvalFilter === "approved" && !entry.approvalDate) return false;
      if (approvalFilter === "pending" && entry.approvalDate) return false;
      if (statusFilter !== "all" && entry.status !== statusFilter) return false;
      if (applicationMonthFilter !== "all") {
        const month = String(new Date(entry.applicationDate).getMonth() + 1).padStart(2, "0");
        if (month !== applicationMonthFilter) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortField === "approvalDate") {
        return compareNullableDate(a.approvalDate, b.approvalDate, sortDirection);
      }

      const aTime = new Date(a[sortField]).getTime();
      const bTime = new Date(b[sortField]).getTime();
      return sortDirection === "asc" ? aTime - bTime : bTime - aTime;
    });
  }, [
    approvalFilter,
    applicationMonthFilter,
    entries,
    sortDirection,
    sortField,
    sourceFilter,
    statusFilter,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    sourceFilter,
    approvalFilter,
    statusFilter,
    applicationMonthFilter,
    sortField,
    sortDirection,
    rowsPerPage,
  ]);

  const totalPages = Math.max(1, Math.ceil(visibleEntries.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, visibleEntries.length);
  const paginatedEntries = visibleEntries.slice(startIndex, endIndex);
  const pageRangeLabel =
    visibleEntries.length === 0 ? "0-0" : `${startIndex + 1}-${endIndex}`;

  function clearFilters() {
    setSourceFilter("all");
    setApprovalFilter("all");
    setStatusFilter("all");
    setApplicationMonthFilter("all");
    setSortField("applicationDate");
    setSortDirection("desc");
  }

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

  function updateEditingField<K extends keyof EntryFormState>(
    key: K,
    value: EntryFormState[K]
  ) {
    setEditingState((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateNewEntryField<K extends keyof EntryFormState>(
    key: K,
    value: EntryFormState[K]
  ) {
    setNewEntry((prev) => ({ ...prev, [key]: value }));
  }

  async function saveEntryChanges(id: string) {
    if (!editingState) return;
    const response = await fetch(`/api/admin/entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingState),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "Could not update entry.");
      return;
    }
    setMessage("Entry updated.");
    setEditingEntryId(null);
    setEditingState(null);
    window.location.reload();
  }

  async function addEntry() {
    const response = await fetch("/api/admin/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newEntry),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "Could not add entry.");
      return;
    }
    setMessage("New timeline entry added.");
    window.location.reload();
  }

  return (
    <div>
      <section>
        <h2 className="govuk-heading-m">Timeline entries</h2>
        <p className="govuk-body">
          Add, edit, or remove entries from both website submissions and Reddit imports.
        </p>
        {message && <p className="govuk-body">{message}</p>}
        <div className="admin-filter-grid govuk-!-margin-bottom-4">
          <div className="govuk-form-group govuk-!-margin-bottom-0">
            <label className="govuk-label" htmlFor="adminFilterSource">
              Source filter
            </label>
            <select
              id="adminFilterSource"
              className="govuk-select"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
            >
              <option value="all">All sources</option>
              <option value="WEBSITE">Website only</option>
              <option value="REDDIT">Reddit only</option>
            </select>
          </div>
          <div className="govuk-form-group govuk-!-margin-bottom-0">
            <label className="govuk-label" htmlFor="adminFilterApproval">
              Approval filter
            </label>
            <select
              id="adminFilterApproval"
              className="govuk-select"
              value={approvalFilter}
              onChange={(event) => setApprovalFilter(event.target.value as ApprovalFilter)}
            >
              <option value="all">All entries</option>
              <option value="approved">Approved only</option>
              <option value="pending">Pending only</option>
            </select>
          </div>
          <div className="govuk-form-group govuk-!-margin-bottom-0">
            <label className="govuk-label" htmlFor="adminFilterStatus">
              Status filter
            </label>
            <select
              id="adminFilterStatus"
              className="govuk-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="all">All statuses</option>
              {statusOptions.map((status) => (
                <option value={status.value} key={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
          <div className="govuk-form-group govuk-!-margin-bottom-0">
            <label className="govuk-label" htmlFor="adminFilterApplicationMonth">
              Application month
            </label>
            <select
              id="adminFilterApplicationMonth"
              className="govuk-select"
              value={applicationMonthFilter}
              onChange={(event) =>
                setApplicationMonthFilter(event.target.value as ApplicationMonthFilter)
              }
            >
              <option value="all">All months</option>
              <option value="01">January</option>
              <option value="02">February</option>
              <option value="03">March</option>
              <option value="04">April</option>
              <option value="05">May</option>
              <option value="06">June</option>
              <option value="07">July</option>
              <option value="08">August</option>
              <option value="09">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
          </div>
          <div className="govuk-form-group govuk-!-margin-bottom-0">
            <label className="govuk-label" htmlFor="adminSortField">
              Sort by
            </label>
            <select
              id="adminSortField"
              className="govuk-select"
              value={sortField}
              onChange={(event) => setSortField(event.target.value as AdminSortField)}
            >
              <option value="applicationDate">Application date</option>
              <option value="biometricDate">Biometric date</option>
              <option value="approvalDate">Approval date</option>
            </select>
          </div>
          <div className="govuk-form-group govuk-!-margin-bottom-0">
            <label className="govuk-label" htmlFor="adminSortDirection">
              Direction
            </label>
            <select
              id="adminSortDirection"
              className="govuk-select"
              value={sortDirection}
              onChange={(event) => setSortDirection(event.target.value as SortDirection)}
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </div>
        </div>
        <div className="admin-filter-meta govuk-!-margin-bottom-3">
          <div>
            <p className="govuk-body-s govuk-!-margin-bottom-0">
              Total entries in database: {entries.length}
            </p>
            <p className="govuk-body-s govuk-!-margin-bottom-0">
              Showing {pageRangeLabel} of {visibleEntries.length} filtered entries
            </p>
          </div>
          <button
            type="button"
            className="govuk-button govuk-button--secondary govuk-!-margin-bottom-0"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        </div>
        <div className="admin-pagination-bar govuk-!-margin-bottom-3">
          <div className="govuk-form-group govuk-!-margin-bottom-0">
            <label className="govuk-label" htmlFor="adminRowsPerPage">
              Rows per page
            </label>
            <select
              id="adminRowsPerPage"
              className="govuk-select"
              value={String(rowsPerPage)}
              onChange={(event) => setRowsPerPage(Number(event.target.value))}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
          <div className="admin-pagination-controls">
            <button
              type="button"
              className="govuk-button govuk-button--secondary govuk-!-margin-bottom-0"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={safeCurrentPage <= 1}
            >
              Previous
            </button>
            <p className="govuk-body-s govuk-!-margin-bottom-0">
              Page {safeCurrentPage} of {totalPages}
            </p>
            <button
              type="button"
              className="govuk-button govuk-button--secondary govuk-!-margin-bottom-0"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={safeCurrentPage >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
        <div className="govuk-table__wrapper admin-entries-table__wrapper">
          <table className="govuk-table admin-entries-table">
            <thead className="govuk-table__head">
              <tr className="govuk-table__row">
                <th className="govuk-table__header">Username</th>
                <th className="govuk-table__header">Method</th>
                <th className="govuk-table__header">Application date</th>
                <th className="govuk-table__header">Biometric date</th>
                <th className="govuk-table__header">Approval date</th>
                <th className="govuk-table__header">Ceremony date</th>
                <th className="govuk-table__header">Status</th>
                <th className="govuk-table__header">HO email</th>
                <th className="govuk-table__header">Source</th>
                <th className="govuk-table__header">Verified</th>
                <th className="govuk-table__header">Actions</th>
              </tr>
            </thead>
            <tbody className="govuk-table__body">
              <tr className="govuk-table__row">
                <td className="govuk-table__cell">
                  <input
                    className="govuk-input admin-table__input"
                    placeholder="Optional username"
                    value={newEntry.username}
                    onChange={(event) => updateNewEntryField("username", event.target.value)}
                  />
                </td>
                <td className="govuk-table__cell">
                  <select
                    className="govuk-select admin-table__select"
                    value={newEntry.applicationMethod}
                    onChange={(event) =>
                      updateNewEntryField("applicationMethod", event.target.value as "ONLINE" | "POST")
                    }
                  >
                    <option value="ONLINE">Online</option>
                    <option value="POST">Post</option>
                  </select>
                </td>
                <td className="govuk-table__cell">
                  <input
                    className="govuk-input admin-table__input"
                    type="date"
                    value={newEntry.applicationDate}
                    onChange={(event) => updateNewEntryField("applicationDate", event.target.value)}
                  />
                </td>
                <td className="govuk-table__cell">
                  <input
                    className="govuk-input admin-table__input"
                    type="date"
                    value={newEntry.biometricDate}
                    onChange={(event) => updateNewEntryField("biometricDate", event.target.value)}
                  />
                </td>
                <td className="govuk-table__cell">
                  <input
                    className="govuk-input admin-table__input"
                    type="date"
                    value={newEntry.approvalDate}
                    onChange={(event) => updateNewEntryField("approvalDate", event.target.value)}
                  />
                </td>
                <td className="govuk-table__cell">
                  <input
                    className="govuk-input admin-table__input"
                    type="date"
                    value={newEntry.ceremonyDate}
                    onChange={(event) => updateNewEntryField("ceremonyDate", event.target.value)}
                  />
                </td>
                <td className="govuk-table__cell">
                  <select
                    className="govuk-select admin-table__select"
                    value={newEntry.status}
                    onChange={(event) =>
                      updateNewEntryField("status", event.target.value as EntryFormState["status"])
                    }
                  >
                    {statusOptions.map((status) => (
                      <option value={status.value} key={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="govuk-table__cell">
                  <input
                    type="checkbox"
                    checked={newEntry.receivedHomeOfficeEmail}
                    onChange={(event) =>
                      updateNewEntryField("receivedHomeOfficeEmail", event.target.checked)
                    }
                  />
                </td>
                <td className="govuk-table__cell">
                  <select
                    className="govuk-select admin-table__select"
                    value={newEntry.sourceType}
                    onChange={(event) =>
                      updateNewEntryField("sourceType", event.target.value as "WEBSITE" | "REDDIT")
                    }
                  >
                    <option value="WEBSITE">WEBSITE</option>
                    <option value="REDDIT">REDDIT</option>
                  </select>
                </td>
                <td className="govuk-table__cell">
                  <input
                    type="checkbox"
                    checked={newEntry.isVerified}
                    onChange={(event) => updateNewEntryField("isVerified", event.target.checked)}
                  />
                </td>
                <td className="govuk-table__cell">
                  <button
                    type="button"
                    className="govuk-button govuk-button--secondary govuk-!-margin-bottom-0"
                    onClick={() => void addEntry()}
                  >
                    Add
                  </button>
                </td>
              </tr>
              {paginatedEntries.map((entry) => (
                <tr className="govuk-table__row" key={entry.id}>
                  {editingEntryId === entry.id && editingState ? (
                    <>
                      <td className="govuk-table__cell">
                        <input
                          className="govuk-input admin-table__input"
                          value={editingState.username}
                          onChange={(event) => updateEditingField("username", event.target.value)}
                        />
                      </td>
                      <td className="govuk-table__cell">
                        <select
                          className="govuk-select admin-table__select"
                          value={editingState.applicationMethod}
                          onChange={(event) =>
                            updateEditingField("applicationMethod", event.target.value as "ONLINE" | "POST")
                          }
                        >
                          <option value="ONLINE">Online</option>
                          <option value="POST">Post</option>
                        </select>
                      </td>
                      <td className="govuk-table__cell">
                        <input
                          className="govuk-input admin-table__input"
                          type="date"
                          value={editingState.applicationDate}
                          onChange={(event) => updateEditingField("applicationDate", event.target.value)}
                        />
                      </td>
                      <td className="govuk-table__cell">
                        <input
                          className="govuk-input admin-table__input"
                          type="date"
                          value={editingState.biometricDate}
                          onChange={(event) => updateEditingField("biometricDate", event.target.value)}
                        />
                      </td>
                      <td className="govuk-table__cell">
                        <input
                          className="govuk-input admin-table__input"
                          type="date"
                          value={editingState.approvalDate}
                          onChange={(event) => updateEditingField("approvalDate", event.target.value)}
                        />
                      </td>
                      <td className="govuk-table__cell">
                        <input
                          className="govuk-input admin-table__input"
                          type="date"
                          value={editingState.ceremonyDate}
                          onChange={(event) => updateEditingField("ceremonyDate", event.target.value)}
                        />
                      </td>
                      <td className="govuk-table__cell">
                        <select
                          className="govuk-select admin-table__select"
                          value={editingState.status}
                          onChange={(event) =>
                            updateEditingField("status", event.target.value as EntryFormState["status"])
                          }
                        >
                          {statusOptions.map((status) => (
                            <option value={status.value} key={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="govuk-table__cell">
                        <input
                          type="checkbox"
                          checked={editingState.receivedHomeOfficeEmail}
                          onChange={(event) =>
                            updateEditingField("receivedHomeOfficeEmail", event.target.checked)
                          }
                        />
                      </td>
                      <td className="govuk-table__cell">
                        <select
                          className="govuk-select admin-table__select"
                          value={editingState.sourceType}
                          onChange={(event) =>
                            updateEditingField("sourceType", event.target.value as "WEBSITE" | "REDDIT")
                          }
                        >
                          <option value="WEBSITE">WEBSITE</option>
                          <option value="REDDIT">REDDIT</option>
                        </select>
                      </td>
                      <td className="govuk-table__cell">
                        <input
                          type="checkbox"
                          checked={editingState.isVerified}
                          onChange={(event) => updateEditingField("isVerified", event.target.checked)}
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="govuk-table__cell">{entry.username ?? "-"}</td>
                      <td className="govuk-table__cell">{entry.applicationMethod}</td>
                      <td className="govuk-table__cell">
                        {new Date(entry.applicationDate).toLocaleDateString("en-GB")}
                      </td>
                      <td className="govuk-table__cell">
                        {new Date(entry.biometricDate).toLocaleDateString("en-GB")}
                      </td>
                      <td className="govuk-table__cell">
                        {entry.approvalDate
                          ? new Date(entry.approvalDate).toLocaleDateString("en-GB")
                          : "-"}
                      </td>
                      <td className="govuk-table__cell">
                        {entry.ceremonyDate
                          ? new Date(entry.ceremonyDate).toLocaleDateString("en-GB")
                          : "-"}
                      </td>
                      <td className="govuk-table__cell">{entry.status}</td>
                      <td className="govuk-table__cell">
                        {entry.receivedHomeOfficeEmail ? "Yes" : "No"}
                      </td>
                      <td className="govuk-table__cell">{entry.sourceType}</td>
                      <td className="govuk-table__cell">{entry.isVerified ? "Yes" : "No"}</td>
                    </>
                  )}
                  <td className="govuk-table__cell">
                    {editingEntryId === entry.id && editingState ? (
                      <div className="admin-table__actions">
                        <button
                          type="button"
                          className="govuk-button govuk-!-margin-bottom-0"
                          onClick={() => void saveEntryChanges(entry.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="govuk-button govuk-button--secondary govuk-!-margin-bottom-0"
                          onClick={() => {
                            setEditingEntryId(null);
                            setEditingState(null);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="admin-table__actions">
                        <button
                          type="button"
                          className="govuk-button govuk-button--secondary govuk-!-margin-bottom-0"
                          onClick={() => {
                            setEditingEntryId(entry.id);
                            setEditingState(toFormState(entry));
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="govuk-button govuk-button--warning govuk-!-margin-bottom-0"
                          onClick={() => void removeEntry(entry.id)}
                        >
                          Remove
                        </button>
                      </div>
                    )}
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
