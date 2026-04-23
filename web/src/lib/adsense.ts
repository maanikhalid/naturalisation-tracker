export const CONSENT_STORAGE_KEY = "nt_cookie_consent";

export const ADSENSE_ENABLED =
  process.env.NEXT_PUBLIC_ADSENSE_ENABLED?.toLowerCase() === "true";

export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";

export const ADSENSE_SLOTS = {
  home: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME ?? "",
  data: process.env.NEXT_PUBLIC_ADSENSE_SLOT_DATA ?? "",
  about: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ABOUT ?? "",
  contributors: process.env.NEXT_PUBLIC_ADSENSE_SLOT_CONTRIBUTORS ?? "",
} as const;

export function canRenderAds() {
  return ADSENSE_ENABLED && ADSENSE_CLIENT.length > 0;
}
