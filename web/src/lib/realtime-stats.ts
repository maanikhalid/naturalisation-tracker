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

/** Linear interpolation; `p` in [0, 100]. */
function percentileLinear(sortedAsc: number[], p: number): number {
  if (!sortedAsc.length) return NaN;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const rank = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedAsc[lo];
  return (
    sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (rank - lo)
  );
}

function formatRangeShort(a: dayjs.Dayjs, b: dayjs.Dayjs): string {
  const sameMonth = a.month() === b.month() && a.year() === b.year();
  if (sameMonth) {
    return `est. ${a.format("D")} - ${b.format("D MMM. YYYY")}`;
  }
  return `est. ${a.format("D MMM.")} - ${b.format("D MMM. YYYY")}`;
}

/** Start of the decadal application-date bin (1–10, 11–20, 21–end), like the spreadsheet. */
function applicationDecadeBinStart(d: Date): dayjs.Dayjs {
  const x = dayjs(d).startOf("day");
  const dom = x.date();
  if (dom <= 10) return x.date(1);
  if (dom <= 20) return x.date(11);
  return x.date(21);
}

function applicationDecadeBinEnd(start: dayjs.Dayjs): dayjs.Dayjs {
  const dom = start.date();
  if (dom === 1) return start.date(10);
  if (dom === 11) return start.date(20);
  return start.endOf("month").startOf("day");
}

function decadeBinsConsecutive(
  earlierBinStart: dayjs.Dayjs,
  laterBinStart: dayjs.Dayjs
): boolean {
  const gapStart = applicationDecadeBinEnd(earlierBinStart).add(1, "day");
  return laterBinStart.isSame(gapStart, "day");
}

type BinAgg = {
  approved: number;
  pending: number;
  pendingAppMillis: number[];
};

/**
 * Application-date range for "who can expect approvals": pending applicants whose
 * submit cohort (10-day band) is actively clearing (high processed share) but not
 * finished — same idea as the spreadsheet frontier table.
 */
/** At most this many decadal bins (from the newest) define the frontier window. */
const FRONTIER_MAX_BINS = 2;
const FRONTIER_PENDING_P_LOW = 35;
const FRONTIER_PENDING_P_HIGH = 65;

function expectApprovalsApplicationDateRange(
  rows: RealtimeStatsInput[],
  opts: { minTotal: number; minRate: number; maxRate: number }
): { min: dayjs.Dayjs; max: dayjs.Dayjs } | null {
  const map = new Map<string, BinAgg>();
  for (const e of rows) {
    const key = applicationDecadeBinStart(e.applicationDate).format(
      "YYYY-MM-DD"
    );
    const b = map.get(key) ?? {
      approved: 0,
      pending: 0,
      pendingAppMillis: [],
    };
    if (e.approvalDate) b.approved += 1;
    else {
      b.pending += 1;
      b.pendingAppMillis.push(dayjs(e.applicationDate).valueOf());
    }
    map.set(key, b);
  }

  const binStarts = [...map.keys()]
    .map((k) => dayjs(k).startOf("day"))
    .sort((a, b) => a.valueOf() - b.valueOf());

  const qualified = (minTotal: number, minRate: number, maxRate: number) => {
    const set = new Set<string>();
    for (const start of binStarts) {
      const key = start.format("YYYY-MM-DD");
      const b = map.get(key)!;
      const total = b.approved + b.pending;
      if (total < minTotal || b.pending < 1) continue;
      const rate = b.approved / total;
      if (rate >= minRate && rate < maxRate) set.add(key);
    }
    return set;
  };

  const findStreak = (set: Set<string>) => {
    if (!set.size) return [] as dayjs.Dayjs[];
    let right = -1;
    for (let i = binStarts.length - 1; i >= 0; i--) {
      if (set.has(binStarts[i].format("YYYY-MM-DD"))) {
        right = i;
        break;
      }
    }
    if (right < 0) return [];
    let left = right;
    while (
      left > 0 &&
      set.has(binStarts[left - 1].format("YYYY-MM-DD")) &&
      decadeBinsConsecutive(binStarts[left - 1], binStarts[left])
    ) {
      left -= 1;
    }
    return binStarts.slice(left, right + 1);
  };

  let streak = findStreak(
    qualified(opts.minTotal, opts.minRate, opts.maxRate)
  );
  if (!streak.length) {
    streak = findStreak(qualified(3, 0.08, opts.maxRate));
  }

  if (!streak.length) return null;

  const cappedStreak =
    streak.length > FRONTIER_MAX_BINS
      ? streak.slice(-FRONTIER_MAX_BINS)
      : streak;

  const millis: number[] = [];
  for (const start of cappedStreak) {
    const b = map.get(start.format("YYYY-MM-DD"))!;
    millis.push(...b.pendingAppMillis);
  }
  if (!millis.length) return null;

  const sorted = [...millis].sort((a, b) => a - b);
  let low = percentileLinear(sorted, FRONTIER_PENDING_P_LOW);
  let high = percentileLinear(sorted, FRONTIER_PENDING_P_HIGH);
  if (low > high) [low, high] = [high, low];
  if (sorted.length < 4) {
    low = sorted[0];
    high = sorted[sorted.length - 1];
  }

  return {
    min: dayjs(low),
    max: dayjs(high),
  };
}

export function buildRealtimeStats(rows: RealtimeStatsInput[]) {
  const approved = rows.filter((e) => e.approvalDate);

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

  let expectApprovalsLabel: string | null = null;
  const frontier = expectApprovalsApplicationDateRange(rows, {
    minTotal: 7,
    minRate: 0.22,
    maxRate: 0.98,
  });
  if (frontier) {
    expectApprovalsLabel = formatRangeShort(frontier.min, frontier.max);
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
