import type { RealtimeStatsResult } from "@/lib/realtime-stats";

export function RealTimeStatistics({ stats }: { stats: RealtimeStatsResult }) {
  const latest = stats.latestAppDateAmongApproved;
  const asOfDate = stats.asOfDate ? new Date(stats.asOfDate) : new Date();
  const daysSinceLatestApproval = latest
    ? asOfDate.getTime() - latest.approvalDate.valueOf()
    : null;
  const daysSinceLatestApprovalRounded =
    daysSinceLatestApproval != null
      ? Math.floor(daysSinceLatestApproval / (24 * 60 * 60 * 1000))
      : null;

  const medianApp = stats.medianAppDateLast4;
  const daysSinceMedianApp =
    medianApp != null
      ? Math.floor(
          (asOfDate.getTime() - medianApp.valueOf()) / (24 * 60 * 60 * 1000)
        )
      : null;

  return (
    <section className="realtime-stats govuk-!-margin-bottom-6" aria-labelledby="realtime-stats-heading">
      <h2 id="realtime-stats-heading" className="realtime-stats__banner">
        Real-time statistics
      </h2>

      <div className="realtime-stats__stack">
        <article className="realtime-stats__block realtime-stats__block--expect">
          <p className="govuk-body-s realtime-stats__label">
            Who can expect approvals?
          </p>
          <p className="govuk-heading-m realtime-stats__value">
            {stats.expectApprovalsLabel ?? "Insufficient data"}
          </p>
        </article>

        <article className="realtime-stats__block realtime-stats__block--median-wait">
          <p className="govuk-body-s realtime-stats__label">
            Median wait from <strong>application date</strong> to{" "}
            <strong>approval</strong> among the 30 approved cases with the most
            recent <strong>application dates</strong>:
          </p>
          <p className="govuk-heading-m realtime-stats__value">
            {stats.medianWaitLast30 != null
              ? `${stats.medianWaitLast30} days`
              : "Insufficient data"}
          </p>
        </article>

        <article className="realtime-stats__block realtime-stats__block--latest">
          <p className="govuk-body-s realtime-stats__label">
            Approved application with the <strong>latest application date</strong>:
          </p>
          <p className="govuk-heading-m realtime-stats__value">
            {latest
              ? `${latest.applicationDate.format("DD/MM/YYYY")} (${daysSinceLatestApprovalRounded} days ago)`
              : "Insufficient data"}
          </p>
        </article>

        <article className="realtime-stats__block realtime-stats__block--median-app">
          <p className="govuk-body-s realtime-stats__label">
            Median application date for applications accepted in the last 4 days:
          </p>
          <p className="govuk-heading-m realtime-stats__value">
            {medianApp && stats.acceptedLast4Count > 0
              ? `${medianApp.format("DD/MM/YYYY")} (${daysSinceMedianApp} days ago - based on ${stats.acceptedLast4Count} apps)`
              : "Insufficient data"}
          </p>
        </article>

        <article className="realtime-stats__block realtime-stats__block--range">
          <p className="govuk-body-s realtime-stats__label">
            Longest and shortest processing time for cases{" "}
            <strong>submitted</strong> in the last 6 months (among approved):
          </p>
          <p className="govuk-heading-m realtime-stats__value">
            {stats.minDur != null && stats.maxDur != null
              ? `${stats.maxDur} days / ${stats.minDur} days`
              : "Insufficient data"}
          </p>
        </article>
      </div>
    </section>
  );
}
