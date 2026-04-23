"use client";

import { useEffect, useMemo, useState } from "react";

type DataRow = {
  id: string;
  username: string | null;
  applicationDate: string;
  biometricDate: string;
  approvalDate: string | null;
  createdAt: string;
  status: string;
  sourceType: "WEBSITE" | "REDDIT";
};

type SortField = "applicationDate" | "biometricDate" | "approvalDate";
type SortDirection = "asc" | "desc";
type ApprovalFilter = "all" | "approved" | "pending";

function dateLabel(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB");
}

function compareNullableDates(
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

export function DataExplorerTable({ rows }: { rows: DataRow[] }) {
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>("applicationDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>("all");
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  const latestAdded = useMemo(() => {
    if (!rows.length) return null;
    return [...rows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  }, [rows]);

  const filteredAndSorted = useMemo(() => {
    const filtered = rows.filter((row) => {
      if (approvalFilter === "approved") return row.approvalDate != null;
      if (approvalFilter === "pending") return row.approvalDate == null;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortField === "approvalDate") {
        return compareNullableDates(a.approvalDate, b.approvalDate, sortDirection);
      }

      const aTime = new Date(a[sortField]).getTime();
      const bTime = new Date(b[sortField]).getTime();
      return sortDirection === "asc" ? aTime - bTime : bTime - aTime;
    });
  }, [approvalFilter, rows, sortDirection, sortField]);

  useEffect(() => {
    setCurrentPage(1);
  }, [approvalFilter, sortDirection, sortField, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, filteredAndSorted.length);
  const paginatedRows = filteredAndSorted.slice(startIndex, endIndex);
  const pageRangeLabel =
    filteredAndSorted.length === 0 ? "0-0" : `${startIndex + 1}-${endIndex}`;

  return (
    <>
      <section className="govuk-!-margin-bottom-4" aria-label="Data explorer filters">
        <h2 className="govuk-heading-m govuk-!-margin-bottom-2">Data controls</h2>
        <p className="govuk-body govuk-!-margin-bottom-2">
          Last added:{" "}
          {latestAdded
            ? `${new Date(latestAdded.createdAt).toLocaleString("en-GB")} (${latestAdded.sourceType}${latestAdded.username ? `, ${latestAdded.username}` : ""})`
            : "No entries yet"}
        </p>
        <button
          type="button"
          className="govuk-button govuk-button--secondary govuk-!-margin-bottom-2"
          onClick={() => setShowFilters((current) => !current)}
          aria-expanded={showFilters}
        >
          {showFilters ? "Hide filters" : "Show filters"}
        </button>

        {showFilters ? (
          <div className="inline-form">
            <div className="govuk-form-group govuk-!-margin-bottom-0">
              <label className="govuk-label" htmlFor="approvalFilter">
                Show entries
              </label>
              <select
                id="approvalFilter"
                className="govuk-select"
                value={approvalFilter}
                onChange={(event) =>
                  setApprovalFilter(event.target.value as ApprovalFilter)
                }
              >
                <option value="all">All entries</option>
                <option value="approved">Approved only</option>
                <option value="pending">Pending only</option>
              </select>
            </div>

            <div className="govuk-form-group govuk-!-margin-bottom-0">
              <label className="govuk-label" htmlFor="sortField">
                Sort by date
              </label>
              <select
                id="sortField"
                className="govuk-select"
                value={sortField}
                onChange={(event) => setSortField(event.target.value as SortField)}
              >
                <option value="applicationDate">Application date</option>
                <option value="biometricDate">Biometric date</option>
                <option value="approvalDate">Approval date</option>
              </select>
            </div>

            <div className="govuk-form-group govuk-!-margin-bottom-0">
              <label className="govuk-label" htmlFor="sortDirection">
                Direction
              </label>
              <select
                id="sortDirection"
                className="govuk-select"
                value={sortDirection}
                onChange={(event) =>
                  setSortDirection(event.target.value as SortDirection)
                }
              >
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>
            </div>
          </div>
        ) : null}
        <div className="admin-filter-meta govuk-!-margin-bottom-2">
          <div>
            <p className="govuk-body-s govuk-!-margin-bottom-0">
              Total entries in database: {rows.length}
            </p>
            <p className="govuk-body-s govuk-!-margin-bottom-0">
              Showing {pageRangeLabel} of {filteredAndSorted.length} filtered entries
            </p>
          </div>
        </div>
        <div className="admin-pagination-bar govuk-!-margin-bottom-0">
          <div className="govuk-form-group govuk-!-margin-bottom-0">
            <label className="govuk-label" htmlFor="dataRowsPerPage">
              Rows per page
            </label>
            <select
              id="dataRowsPerPage"
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
      </section>

      <div className="govuk-table__wrapper">
        <table className="govuk-table">
          <thead className="govuk-table__head">
            <tr className="govuk-table__row">
              <th className="govuk-table__header">Username</th>
              <th className="govuk-table__header">App date</th>
              <th className="govuk-table__header">Biometric</th>
              <th className="govuk-table__header">Approval</th>
              <th className="govuk-table__header">Status</th>
              <th className="govuk-table__header">Source</th>
            </tr>
          </thead>
          <tbody className="govuk-table__body">
            {paginatedRows.map((row) => (
              <tr key={row.id} className="govuk-table__row">
                <td className="govuk-table__cell">{row.username ?? "-"}</td>
                <td className="govuk-table__cell">{dateLabel(row.applicationDate)}</td>
                <td className="govuk-table__cell">{dateLabel(row.biometricDate)}</td>
                <td className="govuk-table__cell">{dateLabel(row.approvalDate)}</td>
                <td className="govuk-table__cell">{row.status}</td>
                <td className="govuk-table__cell">{row.sourceType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
