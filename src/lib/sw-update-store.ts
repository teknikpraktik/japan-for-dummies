"use client";

import { useSyncExternalStore } from "react";

/**
 * Tillstånd för att en ny version av appen väntar (service worker i väntläge). Det visas bara på sidan Mina framsteg,
 * aldrig globalt. Uppdateringen sker alltid på användarens initiativ och laddar om sidan; framstegen ligger i
 * webbläsarens lokala lagring och påverkas inte.
 */
let waiting: ServiceWorker | null = null;
let requested = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const swUpdate = {
  setWaiting(sw: ServiceWorker | null) {
    waiting = sw;
    notify();
  },
  /** Sidan ska bara laddas om efter att användaren själv bett om uppdateringen. */
  get requested() {
    return requested;
  },
  apply() {
    if (!waiting) return;
    requested = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
  },
};

export function useSwUpdateAvailable(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => waiting !== null,
    () => false,
  );
}
