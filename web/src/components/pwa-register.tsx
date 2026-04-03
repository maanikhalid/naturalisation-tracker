"use client";

import { useEffect } from "react";

/**
 * Registers the pass-through service worker in production so browsers that
 * require a fetch-handling SW still offer install / add-to-home-screen.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
