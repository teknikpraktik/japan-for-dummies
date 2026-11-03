"use client";

import { useEffect } from "react";
import { swUpdate } from "@/lib/sw-update-store";

/**
 * Registrerar service workern och kontrollerar i bakgrunden om det finns en ny version. Visar ingenting själv:
 * resultatet visas bara på sidan Mina framsteg (UpdatePanel). Laddar aldrig om sidan av sig själv.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing || !swUpdate.requested) return;
      refreshing = true;
      window.location.reload();
    };
    let cancelled = false;
    const onVisible = (reg: ServiceWorkerRegistration) => () => {
      if (document.visibilityState === "visible") void reg.update().catch(() => {});
    };
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (cancelled) return;
        if (reg.waiting && navigator.serviceWorker.controller) swUpdate.setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          sw?.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) swUpdate.setWaiting(sw);
          });
        });
        // Leta efter uppdatering när appen öppnas igen.
        document.addEventListener("visibilitychange", onVisible(reg));
      })
      .catch(() => {
        /* Offlineläge är en bonus: appen fungerar utan service worker. */
      });
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);
  return null;
}
