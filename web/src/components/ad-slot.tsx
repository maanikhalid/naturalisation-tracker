"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT, canRenderAds } from "@/lib/adsense";

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

  useEffect(() => {
    if (
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
  }, [slot]);

  if (!slot || !canRenderAds()) return null;

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
