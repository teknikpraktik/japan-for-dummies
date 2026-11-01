"use client";

import { useEffect, useRef, useState } from "react";

/** Registrerar service workern och erbjuder uppdatering. Laddar aldrig om sidan av sig själv. */
export function ServiceWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  /** Sidan laddas bara om efter att användaren själv valt att uppdatera (inte vid första installationen). */
  const updateRequested = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing || !updateRequested.current) return;
      refreshing = true;
      window.location.reload();
    };
    let cancelled = false;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (cancelled) return;
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          sw?.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) setWaiting(sw);
          });
        });
        // Leta efter uppdatering när appen öppnas igen.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void reg.update().catch(() => {});
        });
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

  if (!waiting) return null;
  return (
    <div role="status" className="no-print fixed inset-x-3 bottom-20 z-50 mx-auto max-w-xl rounded-xl border-2 border-indigo bg-card p-4 shadow-lg md:bottom-4">
      <p className="font-semibold">Det finns en ny version av utbildningen.</p>
      <p className="mt-1 text-sm text-ink-soft">Dina framsteg och pågående test sparas. Uppdatera när det passar, till exempel efter ett pågående test.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn btn-primary btn-small" onClick={() => {
            updateRequested.current = true;
            waiting.postMessage({ type: "SKIP_WAITING" });
          }}>
          Uppdatera nu
        </button>
        <button className="btn btn-small" onClick={() => setWaiting(null)}>
          Senare
        </button>
      </div>
    </div>
  );
}
