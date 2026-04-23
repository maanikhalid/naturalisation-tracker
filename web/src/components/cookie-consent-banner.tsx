"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CONSENT_CHANGE_EVENT,
  persistConsent,
  readConsent,
} from "@/components/consent-utils";

export function CookieConsentBanner() {
  const [consent, setConsent] = useState<"accepted" | "rejected" | null>(() => {
    if (typeof window === "undefined") return null;
    return readConsent();
  });

  useEffect(() => {
    function onConsentChanged() {
      setConsent(readConsent());
    }

    window.addEventListener(CONSENT_CHANGE_EVENT, onConsentChanged);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onConsentChanged);
  }, []);

  if (consent) return null;

  return (
    <section
      className="app-consent-banner"
      role="region"
      aria-label="Cookie and advertising consent"
    >
      <div className="govuk-width-container">
        <p className="govuk-body app-consent-banner__text">
          We use optional advertising cookies to show a subtle ad and help fund the
          tracker. You can change this anytime in our{" "}
          <Link href="/cookies" className="govuk-link">
            cookie settings
          </Link>
          .
        </p>
        <div className="app-consent-banner__actions">
          <button
            type="button"
            className="govuk-button"
            onClick={() => persistConsent("accepted")}
          >
            Accept ad cookies
          </button>
          <button
            type="button"
            className="govuk-button govuk-button--secondary"
            onClick={() => persistConsent("rejected")}
          >
            Reject ad cookies
          </button>
        </div>
      </div>
    </section>
  );
}
