"use client";

import { useEffect, useRef, useState } from "react";
import { ADSENSE_CLIENT, canRenderAds } from "@/lib/adsense";
import { CONSENT_CHANGE_EVENT, readConsent } from "@/components/consent-utils";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdSlotProps = {
  slot: string;
};

export function AdSlot({ slot }: AdSlotProps) {
  const adRef = useRef<HTMLModElement>(null);
  const didRequestAdRef = useRef(false);
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

  useEffect(() => {
    if (
      !consentAccepted ||
      !canRenderAds() ||
      !slot ||
      didRequestAdRef.current ||
      !adRef.current
    ) {
      return;
    }

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      didRequestAdRef.current = true;
    } catch {
      // Keep page stable if ad script is blocked/unavailable.
    }
  }, [consentAccepted, slot]);

  if (!slot || !canRenderAds() || !consentAccepted) return null;

  return (
    <section className="app-ad-slot" aria-label="Advertisement">
      <p className="app-ad-slot__label">Advertisement</p>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </section>
  );
}
