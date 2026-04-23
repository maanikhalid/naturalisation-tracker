import { AdSlot } from "@/components/ad-slot";
import { ADSENSE_SLOTS } from "@/lib/adsense";

export default function AboutPage() {
  return (
    <main className="govuk-width-container app-main">
      <h1 className="govuk-heading-l">Methodology and data policy</h1>
      <p className="govuk-body">
        This tracker is community-reported and is not an official Home Office
        source. It is intended to help applicants understand typical processing
        patterns, not to predict an individual outcome.
      </p>
      <ul className="govuk-list govuk-list--bullet">
        <li>Scope: UK naturalisation Form AN only.</li>
        <li>Dates are collected with day, month, and year precision.</li>
        <li>Reddit imports are marked as unverified.</li>
        <li>Admins can remove spam or clearly false entries.</li>
      </ul>
      <AdSlot slot={ADSENSE_SLOTS.about} />
    </main>
  );
}
