"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="govuk-width-container app-main">
      <h1 className="govuk-heading-l">Admin area failed to load</h1>
      <p className="govuk-body">
        The server hit an error while rendering this page. Common causes: database unreachable or
        missing tables (run Prisma migrate or db push), or missing{" "}
        <code className="govuk-body-s">DATABASE_URL</code> /{" "}
        <code className="govuk-body-s">ADMIN_JWT_SECRET</code> in the app environment.
      </p>
      {error.digest ? (
        <p className="govuk-body-s govuk-!-margin-bottom-4">Reference: {error.digest}</p>
      ) : null}
      <button type="button" className="govuk-button" onClick={() => reset()}>
        Try again
      </button>
    </main>
  );
}
