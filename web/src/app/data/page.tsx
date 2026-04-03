import { prisma } from "@/lib/db";

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

  return (
    <main className="govuk-width-container app-main">
      <h1 className="govuk-heading-l">Data explorer</h1>
      <p className="govuk-body">
        Source labels show where each row came from: website form submission or
        imported Reddit comment.
      </p>
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
            {entries.map((row: DataRow) => (
              <tr key={row.id} className="govuk-table__row">
                <td className="govuk-table__cell">{row.username ?? "-"}</td>
                <td className="govuk-table__cell">
                  {new Date(row.applicationDate).toLocaleDateString("en-GB")}
                </td>
                <td className="govuk-table__cell">
                  {new Date(row.biometricDate).toLocaleDateString("en-GB")}
                </td>
                <td className="govuk-table__cell">
                  {row.approvalDate
                    ? new Date(row.approvalDate).toLocaleDateString("en-GB")
                    : "-"}
                </td>
                <td className="govuk-table__cell">{row.status}</td>
                <td className="govuk-table__cell">{row.sourceType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
