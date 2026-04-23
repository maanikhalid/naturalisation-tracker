import type { Metadata } from "next";
import { AdSlot } from "@/components/ad-slot";
import { ADSENSE_SLOTS } from "@/lib/adsense";

export const metadata: Metadata = {
  title: "Contributors",
  description:
    "Credits and how to contribute or send feedback to the UK naturalisation tracker",
};

export default function ContributorsPage() {
  return (
    <main className="govuk-width-container app-main">
      <h1 className="govuk-heading-l">Contributors</h1>
      <p className="govuk-body">
        This project owes a debt to community members who shared timelines and
        tooling before this site existed.
      </p>
      <h2 className="govuk-heading-m">Inspiration</h2>
      <p className="govuk-body">
        Thank you to Reddit user{" "}
        <a
          href="https://www.reddit.com/user/Execed/"
          className="govuk-link"
          rel="noopener noreferrer"
          target="_blank"
        >
          u/Execed
        </a>{" "}
        for the spreadsheet-based processing analysis that inspired the approach
        used here (cohort-style statistics and the processing frontier idea).
      </p>
      <h2 className="govuk-heading-m">Feedback and contributions</h2>
      <p className="govuk-body">
        If you would like to suggest improvements, report a problem, or contribute
        data or ideas, email{" "}
        <a
          href="mailto:tracker@howlongisthewait.co.uk"
          className="govuk-link"
        >
          tracker@howlongisthewait.co.uk
        </a>
        .
      </p>
      <AdSlot slot={ADSENSE_SLOTS.contributors} />
    </main>
  );
}
