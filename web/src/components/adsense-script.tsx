"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { ADSENSE_CLIENT, canRenderAds } from "@/lib/adsense";
import { CONSENT_CHANGE_EVENT, readConsent } from "@/components/consent-utils";

export function AdSenseScript() {
  const [consentAccepted, setConsentAccepted] = useState(() => {
    if (typeof window === "undefined") return false;
    return readConsent() === "accepted";
  });

  useEffect(() => {
    function onConsentChanged() {
      setConsentAccepted(readConsent() === "accepted");
    }

    window.addEventListener(CONSENT_CHANGE_EVENT, onConsentChanged);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onConsentChanged);
  }, []);

  if (!canRenderAds() || !consentAccepted) return null;

  return (
    <Script
      id="google-adsense-script"
      async
      strategy="afterInteractive"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
      crossOrigin="anonymous"
    />
  );
}
