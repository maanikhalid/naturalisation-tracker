"use client";

import { useEffect, useState } from "react";
import {
  clearConsent,
  CONSENT_CHANGE_EVENT,
  persistConsent,
  readConsent,
} from "@/components/consent-utils";

export function ConsentPreferences() {
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

  return (
    <div className="app-consent-preferences">
      <p className="govuk-body">
        Current advertising consent:{" "}
        <strong>{consent ? consent : "not set (banner will show)"}</strong>
      </p>
      <div className="app-consent-preferences__actions">
        <button
          type="button"
          className="govuk-button"
          onClick={() => persistConsent("accepted")}
        >
          Allow ad cookies
        </button>
        <button
          type="button"
          className="govuk-button govuk-button--secondary"
          onClick={() => persistConsent("rejected")}
        >
          Disallow ad cookies
        </button>
        <button
          type="button"
          className="govuk-link app-consent-preferences__reset"
          onClick={() => clearConsent()}
        >
          Reset choice
        </button>
      </div>
    </div>
  );
}
