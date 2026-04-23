"use client";

import { CONSENT_STORAGE_KEY } from "@/lib/adsense";

export type ConsentValue = "accepted" | "rejected";

const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
export const CONSENT_CHANGE_EVENT = "nt-consent-changed";

export function readConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;

  const saved = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  if (saved === "accepted" || saved === "rejected") return saved;

  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${CONSENT_STORAGE_KEY}=`));
  const value = cookie?.split("=")[1];
  if (value === "accepted" || value === "rejected") return value;
  return null;
}

export function persistConsent(value: ConsentValue) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
  document.cookie = `${CONSENT_STORAGE_KEY}=${value}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: value }));
}

export function clearConsent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  document.cookie = `${CONSENT_STORAGE_KEY}=; Max-Age=0; Path=/; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: null }));
}
