import type { Metadata } from "next";
import { ConsentPreferences } from "@/components/consent-preferences";

export const metadata: Metadata = {
  title: "Cookie settings",
  description:
    "Choose whether UK Naturalisation Tracker can load optional ad cookies for Google AdSense.",
};

export default function CookiesPage() {
  return (
    <main className="govuk-width-container app-main">
      <h1 className="govuk-heading-l">Cookie settings</h1>
      <p className="govuk-body">
        Essential cookies keep core functionality running, such as admin authentication.
        Optional advertising cookies are only used if you explicitly allow them.
      </p>
      <ConsentPreferences />
    </main>
  );
}
