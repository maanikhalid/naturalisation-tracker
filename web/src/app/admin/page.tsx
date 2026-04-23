import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminLogin } from "@/components/admin-login";
import { logoutAdmin } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) {
    return (
      <main className="govuk-width-container app-main admin-page">
        <h1 className="govuk-heading-l">Admin login</h1>
        <AdminLogin />
      </main>
    );
  }

  let entries;
  let configs;
  try {
    [entries, configs] = await Promise.all([
      prisma.timelineEntry.findMany({
        where: { isRemoved: false },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.redditTrackingConfig.findMany({ orderBy: { createdAt: "desc" } }),
    ]);
  } catch (err) {
    console.error("Admin dashboard: database query failed", err);
    return (
      <main className="govuk-width-container app-main admin-page">
        <div className="admin-header">
          <h1 className="govuk-heading-l">Admin dashboard</h1>
          <form action={logoutAdmin}>
            <button type="submit" className="govuk-button govuk-button--secondary">
              Logout
            </button>
          </form>
        </div>
        <div className="govuk-error-summary" role="alert">
          <h2 className="govuk-error-summary__title">Could not load dashboard data</h2>
          <div className="govuk-error-summary__body">
            <p className="govuk-body">
              The app could not reach the database or the schema may be out of date. On the server,
              confirm <code className="govuk-body-s">DATABASE_URL</code> is correct, then run{" "}
              <code className="govuk-body-s">npx prisma db push</code> or your migration command.
              Check the application logs for the underlying error.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const serializedEntries = entries.map(
    (entry: {
      id: string;
      username: string | null;
      applicationMethod: "ONLINE" | "POST";
      applicationDate: Date;
      biometricDate: Date;
      approvalDate: Date | null;
      receivedHomeOfficeEmail: boolean;
      ceremonyDate: Date | null;
      status:
        | "SUBMITTED"
        | "BIOMETRICS_DONE"
        | "EMAIL_RECEIVED"
        | "APPROVED"
        | "CEREMONY_PENDING"
        | "CEREMONY_DONE";
      sourceType: "WEBSITE" | "REDDIT";
      isVerified: boolean;
    }) => ({
    id: entry.id,
    username: entry.username,
    applicationMethod: entry.applicationMethod,
    applicationDate: entry.applicationDate.toISOString(),
    biometricDate: entry.biometricDate.toISOString(),
    approvalDate: entry.approvalDate ? entry.approvalDate.toISOString() : null,
    receivedHomeOfficeEmail: entry.receivedHomeOfficeEmail,
    ceremonyDate: entry.ceremonyDate ? entry.ceremonyDate.toISOString() : null,
    status: entry.status,
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
    <main className="govuk-width-container app-main admin-page">
      <div className="admin-header">
        <h1 className="govuk-heading-l">Admin dashboard</h1>
        <form action={logoutAdmin}>
          <button type="submit" className="govuk-button govuk-button--secondary">
            Logout
          </button>
        </form>
      </div>
      <AdminDashboard entries={serializedEntries} configs={serializedConfigs} />
    </main>
  );
}
