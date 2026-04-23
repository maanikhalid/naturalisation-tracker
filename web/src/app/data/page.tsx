import { prisma } from "@/lib/db";
import { DataExplorerTable } from "@/components/data-explorer-table";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const entries = await prisma.timelineEntry.findMany({
    where: { isRemoved: false },
    orderBy: { applicationDate: "desc" },
    take: 500,
  });

  type DataRow = {
    id: string;
    username: string | null;
    applicationDate: Date;
    biometricDate: Date;
    approvalDate: Date | null;
    status: string;
    sourceType: "WEBSITE" | "REDDIT";
  };

  const serializedEntries = entries.map((row: DataRow) => ({
    id: row.id,
    username: row.username,
    applicationDate: row.applicationDate.toISOString(),
    biometricDate: row.biometricDate.toISOString(),
    approvalDate: row.approvalDate ? row.approvalDate.toISOString() : null,
    status: row.status,
    sourceType: row.sourceType,
  }));

  return (
    <main className="govuk-width-container app-main">
      <h1 className="govuk-heading-l">Data explorer</h1>
      <p className="govuk-body">
        Source labels show where each row came from: website form submission or
        imported Reddit comment.
      </p>
      <DataExplorerTable rows={serializedEntries} />
    </main>
  );
}
