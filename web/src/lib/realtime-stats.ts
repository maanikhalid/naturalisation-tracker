import dayjs from "dayjs";

export type RealtimeStatsInput = {
  applicationDate: Date;
  biometricDate: Date;
  approvalDate: Date | null;
  createdAt: Date;
};

function medianDays(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatRangeShort(a: dayjs.Dayjs, b: dayjs.Dayjs): string {
  const sameMonth = a.month() === b.month() && a.year() === b.year();
  if (sameMonth) {
    return `est. ${a.format("D")} - ${b.format("D MMM. YYYY")}`;
  }
  return `est. ${a.format("D MMM.")} - ${b.format("D MMM. YYYY")}`;
}

function approvalDurations(approved: RealtimeStatsInput[]): number[] {
  return approved.map((e) =>
    dayjs(e.approvalDate!).diff(e.applicationDate, "day")
  );
}

/** Months between two calendar months (signed). */
function monthDeltaFromCalendar(
  a: dayjs.Dayjs,
  b: dayjs.Dayjs
): number {
  return (a.year() - b.year()) * 12 + (a.month() - b.month());
}

/**
 * Durations for approved rows whose application date falls in the same
 * calendar month as `center`, or within +/- `spanMonths` of that month.
 */
function cohortDurationsBySubmitWindow(
  pendingApplicationDate: Date,
  approved: RealtimeStatsInput[],
  spanMonths: number
): number[] {
  const center = dayjs(pendingApplicationDate).startOf("month");
  const out: number[] = [];
  for (const e of approved) {
    const app = dayjs(e.applicationDate).startOf("month");
    if (Math.abs(monthDeltaFromCalendar(app, center)) <= spanMonths) {
      out.push(dayjs(e.approvalDate!).diff(e.applicationDate, "day"));
    }
  }
  return out;
}

const COHORT_MIN_SAMPLES = 3;
const COHORT_MAX_MONTH_SPAN = 6;

/**
 * Median app-to-approval days for people who submitted around the same time
 * as this pending case (expanding month window), else all approved.
 */
function medianWaitForSubmitCohort(
  pendingApplicationDate: Date,
  approved: RealtimeStatsInput[]
): number | null {
  if (!approved.length) return null;
  for (let span = 0; span <= COHORT_MAX_MONTH_SPAN; span++) {
    const durs = cohortDurationsBySubmitWindow(
      pendingApplicationDate,
      approved,
      span
    );
    if (durs.length >= COHORT_MIN_SAMPLES) return medianDays(durs);
  }
  const lastWindow = cohortDurationsBySubmitWindow(
    pendingApplicationDate,
    approved,
    COHORT_MAX_MONTH_SPAN
  );
  if (lastWindow.length > 0) return medianDays(lastWindow);
  return medianDays(approvalDurations(approved));
}

export function buildRealtimeStats(rows: RealtimeStatsInput[]) {
  const approved = rows.filter((e) => e.approvalDate);
  const pending = rows.filter((e) => !e.approvalDate);

  const last30BySubmitDate = [...approved]
    .sort(
      (a, b) =>
        dayjs(b.applicationDate).valueOf() - dayjs(a.applicationDate).valueOf()
    )
    .slice(0, 30);

  const last30Durations = last30BySubmitDate.map((e) =>
    dayjs(e.approvalDate!).diff(e.applicationDate, "day")
  );
  const medianWaitLast30 = medianDays(last30Durations);

  const allDurations = approvalDurations(approved);
  const medianFallback = medianDays(allDurations);
  const medianForProjection = medianWaitLast30 ?? medianFallback;

  let expectApprovalsLabel: string | null = null;
  if (pending.length && approved.length) {
    const estimates: dayjs.Dayjs[] = [];
    for (const e of pending) {
      const cohortMedian = medianWaitForSubmitCohort(
        e.applicationDate,
        approved
      );
      if (cohortMedian != null && cohortMedian > 0) {
        estimates.push(dayjs(e.applicationDate).add(cohortMedian, "day"));
      }
    }
    if (estimates.length) {
      const ts = estimates.map((d) => d.valueOf());
      const min = dayjs(Math.min(...ts));
      const max = dayjs(Math.max(...ts));
      expectApprovalsLabel = formatRangeShort(min, max);
    }
  } else if (medianForProjection != null && medianForProjection > 0) {
    if (!pending.length) {
      const centre = dayjs().add(medianForProjection, "day");
      const min = centre.subtract(4, "day");
      const max = centre.add(4, "day");
      expectApprovalsLabel = formatRangeShort(min, max);
    }
  }

  let latestAppDateAmongApproved: {
    applicationDate: dayjs.Dayjs;
    approvalDate: dayjs.Dayjs;
  } | null = null;
  if (approved.length) {
    const withLatestApp = approved.reduce((best, e) =>
      dayjs(e.applicationDate).isAfter(dayjs(best.applicationDate)) ? e : best
    );
    latestAppDateAmongApproved = {
      applicationDate: dayjs(withLatestApp.applicationDate),
      approvalDate: dayjs(withLatestApp.approvalDate!),
    };
  }

  const fourDaysAgo = dayjs().subtract(4, "day");
  const acceptedLast4Days = rows.filter((e) =>
    dayjs(e.createdAt).isAfter(fourDaysAgo)
  );
  const appDateMillis = acceptedLast4Days.map((e) =>
    dayjs(e.applicationDate).valueOf()
  );
  const medianAppMillis = medianDays(appDateMillis);
  const medianAppDateLast4 =
    medianAppMillis != null ? dayjs(medianAppMillis) : null;

  const sixMonthsAgo = dayjs().subtract(6, "month");
  const approvedWithSubmitInLast6m = approved.filter((e) =>
    dayjs(e.applicationDate).isAfter(sixMonthsAgo)
  );
  const durations6m = approvedWithSubmitInLast6m.map((e) =>
    dayjs(e.approvalDate!).diff(e.applicationDate, "day")
  );
  const minDur =
    durations6m.length > 0 ? Math.min(...durations6m) : null;
  const maxDur =
    durations6m.length > 0 ? Math.max(...durations6m) : null;

  return {
    medianWaitLast30:
      medianWaitLast30 != null ? Math.round(medianWaitLast30) : null,
    expectApprovalsLabel,
    latestAppDateAmongApproved,
    medianAppDateLast4,
    acceptedLast4Count: acceptedLast4Days.length,
    minDur,
    maxDur,
  };
}

export type RealtimeStatsResult = ReturnType<typeof buildRealtimeStats>;
