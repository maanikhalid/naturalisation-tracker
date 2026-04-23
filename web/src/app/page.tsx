import Link from "next/link";
import { prisma } from "@/lib/db";
import { buildRealtimeStats } from "@/lib/realtime-stats";
import { buildStats } from "@/lib/stats";
import { RealTimeStatistics } from "@/components/real-time-statistics";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [rows, removedCount, lastUpdated] = await Promise.all([
    prisma.timelineEntry.findMany({
      where: { isRemoved: false },
      select: {
        applicationDate: true,
        biometricDate: true,
        approvalDate: true,
        sourceType: true,
        createdAt: true,
      },
    }),
    prisma.timelineEntry.count({ where: { isRemoved: true } }),
    prisma.timelineEntry.findFirst({
      where: { isRemoved: false },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);
  const stats = buildStats(rows);
  const realtime = buildRealtimeStats(rows, lastUpdated?.updatedAt ?? new Date());

  return (
    <main className="govuk-width-container app-main">
      <h1 className="govuk-heading-l">UK Naturalisation (Form AN) tracker</h1>
      <p className="govuk-body">
        Community-reported timelines only. This is not an official Home Office
        service.
      </p>

      <RealTimeStatistics stats={realtime} />

      <div className="kpi-grid">
        <article className="kpi-card">
          <p className="govuk-body-s">Total active submissions</p>
          <p className="govuk-heading-m">{stats.total}</p>
        </article>
        <article className="kpi-card">
          <p className="govuk-body-s">Median application to approval</p>
          <p className="govuk-heading-m">{stats.median} days</p>
        </article>
        <article className="kpi-card">
          <p className="govuk-body-s">Processed cases</p>
          <p className="govuk-heading-m">{stats.approvedCount}</p>
        </article>
        <article className="kpi-card">
          <p className="govuk-body-s">Source split</p>
          <p className="govuk-heading-m">
            Website {stats.websiteCount} / Reddit {stats.redditCount}
          </p>
        </article>
      </div>

      <h2 className="govuk-heading-m">Percentiles</h2>
      <ul className="govuk-list govuk-list--bullet">
        <li>P50: {stats.p50} days</li>
        <li>P75: {stats.p75} days</li>
        <li>P90: {stats.p90} days</li>
        <li>Removed as spam/false: {removedCount}</li>
        <li>
          Last data update:{" "}
          {lastUpdated
            ? new Date(lastUpdated.updatedAt).toLocaleString("en-GB")
            : "No entries yet"}
        </li>
      </ul>

      <h2 className="govuk-heading-m">Processing rate by application month</h2>
      <div className="govuk-table__wrapper">
        <table className="govuk-table">
          <thead className="govuk-table__head">
            <tr className="govuk-table__row">
              <th className="govuk-table__header">Month</th>
              <th className="govuk-table__header">Total</th>
              <th className="govuk-table__header">Processed</th>
              <th className="govuk-table__header">Rate</th>
            </tr>
          </thead>
          <tbody className="govuk-table__body">
            {stats.byMonth.map((row) => (
              <tr key={row.month} className="govuk-table__row">
                <td className="govuk-table__cell">{row.month}</td>
                <td className="govuk-table__cell">{row.total}</td>
                <td className="govuk-table__cell">{row.approved}</td>
                <td className="govuk-table__cell">{row.rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="govuk-body">
        <Link href="/submit" className="govuk-link">
          Submit your timeline
        </Link>
      </p>
    </main>
  );
}
