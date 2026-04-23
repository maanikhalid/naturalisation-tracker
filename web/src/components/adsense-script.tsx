"use client";

import Script from "next/script";
import { ADSENSE_CLIENT, canRenderAds } from "@/lib/adsense";

export function AdSenseScript() {
  if (!canRenderAds()) return null;

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
