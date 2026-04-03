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

export function buildRealtimeStats(rows: RealtimeStatsInput[]) {
  const approved = rows.filter((e) => e.approvalDate);
  const pending = rows.filter((e) => !e.approvalDate);

  const last30Approved = [...approved]
    .sort(
      (a, b) =>
        dayjs(b.approvalDate!).valueOf() - dayjs(a.approvalDate!).valueOf()
    )
    .slice(0, 30);

  const last30Durations = last30Approved.map((e) =>
    dayjs(e.approvalDate!).diff(e.applicationDate, "day")
  );
  const medianWaitLast30 = medianDays(last30Durations);

  const allDurations = approved.map((e) =>
    dayjs(e.approvalDate!).diff(e.applicationDate, "day")
  );
  const medianFallback = medianDays(allDurations);
  const medianForProjection = medianWaitLast30 ?? medianFallback;

  let expectApprovalsLabel: string | null = null;
  if (medianForProjection != null && medianForProjection > 0) {
    if (pending.length) {
      const estimates = pending.map((e) =>
        dayjs(e.applicationDate).add(medianForProjection, "day")
      );
      const ts = estimates.map((d) => d.valueOf());
      const min = dayjs(Math.min(...ts));
      const max = dayjs(Math.max(...ts));
      expectApprovalsLabel = formatRangeShort(min, max);
    } else {
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
  const approvedLast6m = approved.filter((e) =>
    dayjs(e.approvalDate!).isAfter(sixMonthsAgo)
  );
  const durations6m = approvedLast6m.map((e) =>
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
