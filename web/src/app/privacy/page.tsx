import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How the UK Naturalisation Tracker handles analytics, ad personalisation consent, and user data.",
};

export default function PrivacyPage() {
  return (
    <main className="govuk-width-container app-main">
      <h1 className="govuk-heading-l">Privacy policy</h1>
      <p className="govuk-body">
        UK Naturalisation Tracker is a community-led service. We collect only the data
        needed to run timeline submissions and improve the service.
      </p>

      <h2 className="govuk-heading-m">What we collect</h2>
      <ul className="govuk-list govuk-list--bullet">
        <li>Timeline dates and optional username submitted through the form.</li>
        <li>Basic visit analytics through Google Tag Manager.</li>
        <li>Optional advertising consent choice (accept/reject).</li>
      </ul>

      <h2 className="govuk-heading-m">Advertising</h2>
      <p className="govuk-body">
        We may display Google AdSense advertisements to help fund hosting and
        maintenance. Ads are loaded only after you explicitly accept ad cookies.
      </p>
      <p className="govuk-body">
        Google may process data according to its own privacy terms when ads are
        enabled. You can change your choice any time on the cookie settings page.
      </p>

      <h2 className="govuk-heading-m">Data quality disclaimer</h2>
      <p className="govuk-body">
        Community-submitted timelines may be incomplete or inaccurate. Always verify
        important decisions with official Home Office sources.
      </p>
    </main>
  );
}
