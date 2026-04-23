import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie settings",
  description:
    "Information about essential cookies and Google CMP controls for ad consent.",
};

export default function CookiesPage() {
  return (
    <main className="govuk-width-container app-main">
      <h1 className="govuk-heading-l">Cookie settings</h1>
      <p className="govuk-body">
        Essential cookies keep core functionality running, such as admin authentication.
        Advertising consent in EEA/UK/Switzerland is handled via Google&apos;s Consent
        Management Platform (CMP) message.
      </p>
      <p className="govuk-body">
        You can review or change that ad-consent choice through Google&apos;s consent
        message controls when shown on the site.
      </p>
    </main>
  );
}
