import { redirect } from "next/navigation";
import { clearAdminCookie, getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminLogin } from "@/components/admin-login";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) {
    return (
      <main className="govuk-width-container app-main">
        <h1 className="govuk-heading-l">Admin login</h1>
        <AdminLogin />
      </main>
    );
  }

  const [entries, configs] = await Promise.all([
    prisma.timelineEntry.findMany({
      where: { isRemoved: false },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.redditTrackingConfig.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const serializedEntries = entries.map(
    (entry: {
      id: string;
      username: string | null;
      applicationDate: Date;
      approvalDate: Date | null;
      sourceType: "WEBSITE" | "REDDIT";
      isVerified: boolean;
    }) => ({
    id: entry.id,
    username: entry.username,
    applicationDate: entry.applicationDate.toISOString(),
    approvalDate: entry.approvalDate ? entry.approvalDate.toISOString() : null,
    sourceType: entry.sourceType,
    isVerified: entry.isVerified,
    })
  );

  const serializedConfigs = configs.map(
    (config: {
      id: string;
      postUrl: string;
      syncIntervalMins: number;
      active: boolean;
      lastSyncedAt: Date | null;
    }) => ({
    id: config.id,
    postUrl: config.postUrl,
    syncIntervalMins: config.syncIntervalMins,
    active: config.active,
    lastSyncedAt: config.lastSyncedAt ? config.lastSyncedAt.toISOString() : null,
    })
  );

  return (
    <main className="govuk-width-container app-main">
      <div className="admin-header">
        <h1 className="govuk-heading-l">Admin dashboard</h1>
        <form
          action={async () => {
            "use server";
            await clearAdminCookie();
            redirect("/admin");
          }}
        >
          <button className="govuk-button govuk-button--secondary">Logout</button>
        </form>
      </div>
      <AdminDashboard entries={serializedEntries} configs={serializedConfigs} />
    </main>
  );
}
