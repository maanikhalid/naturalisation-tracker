/** Canonical site origin for metadata, OG URLs, and PWA scope. No trailing slash. */
export const DEFAULT_SITE_URL = "https://howlongisthewait.co.uk";

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return DEFAULT_SITE_URL;
}
