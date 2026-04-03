import dayjs from "dayjs";

export type StatsInput = {
  applicationDate: Date;
  biometricDate: Date;
  approvalDate: Date | null;
  sourceType: "WEBSITE" | "REDDIT";
};

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function buildStats(entries: StatsInput[]) {
  const approved = entries.filter((e) => e.approvalDate);
  const appToApproval = approved.map((e) =>
    dayjs(e.approvalDate!).diff(e.applicationDate, "day")
  );

  const byAppMonth = new Map<string, { total: number; approved: number }>();
  for (const entry of entries) {
    const key = dayjs(entry.applicationDate).format("MMM YYYY");
    const bucket = byAppMonth.get(key) ?? { total: 0, approved: 0 };
    bucket.total += 1;
    if (entry.approvalDate) bucket.approved += 1;
    byAppMonth.set(key, bucket);
  }

  return {
    total: entries.length,
    approvedCount: approved.length,
    p50: percentile(appToApproval, 50),
    p75: percentile(appToApproval, 75),
    p90: percentile(appToApproval, 90),
    median: percentile(appToApproval, 50),
    websiteCount: entries.filter((e) => e.sourceType === "WEBSITE").length,
    redditCount: entries.filter((e) => e.sourceType === "REDDIT").length,
    byMonth: [...byAppMonth.entries()].map(([month, value]) => ({
      month,
      total: value.total,
      approved: value.approved,
      rate: value.total ? Math.round((value.approved / value.total) * 100) : 0,
    })),
  };
}
