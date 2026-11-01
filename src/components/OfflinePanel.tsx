"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkReady,
  downloadOffline,
  DownloadError,
  fetchManifest,
  formatBytes,
  offlineSupported,
  readMeta,
  removeOffline,
  type DownloadProgress,
  type OfflineMeta,
} from "@/lib/offline";

type View =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "idle"; hadBefore: boolean }
  | { kind: "downloading"; progress: DownloadProgress }
  | { kind: "ready"; meta: OfflineMeta; updateAvailable: boolean }
  | { kind: "error"; message: string; errorKind: string };

export function OfflinePanel() {
  const [view, setView] = useState<View>({ kind: "loading" });
  const abortRef = useRef<AbortController | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!offlineSupported() || process.env.NODE_ENV !== "production") {
        if (!cancelled) setView({ kind: offlineSupported() ? "idle" : "unsupported", hadBefore: false });
        return;
      }
      const meta = readMeta();
      if (meta && (await checkReady(meta))) {
        let updateAvailable = false;
        try {
          if (navigator.onLine) updateAvailable = (await fetchManifest()).buildId !== meta.buildId;
        } catch {
          /* ingen koll möjlig just nu */
        }
        if (!cancelled) setView({ kind: "ready", meta, updateAvailable });
      } else if (!cancelled) setView({ kind: "idle", hadBefore: Boolean(meta) });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const start = useCallback(async () => {
    const ctl = new AbortController();
    abortRef.current = ctl;
    setView({ kind: "downloading", progress: { phase: "preparing", done: 0, total: 0, bytesDone: 0, bytesTotal: 0 } });
    try {
      const meta = await downloadOffline((progress) => setView({ kind: "downloading", progress }), ctl.signal);
      setView({ kind: "ready", meta, updateAvailable: false });
    } catch (e) {
      const err = e instanceof DownloadError ? e : new DownloadError("interrupted", "Något gick fel under nedladdningen.");
      setView({ kind: "error", message: err.message, errorKind: err.kind });
    }
  }, []);

  return (
    <section aria-labelledby="offline" id="offline" className="card space-y-3">
      <h2 id="offline">Gör utbildningen tillgänglig offline</h2>
      <p>
        Ladda ned alla sidor, övningar och test (inklusive de sex pilotkapitlen) till enheten så att de går att öppna utan internet. Dina framsteg sparas ändå lokalt som vanligt.
      </p>
      <p aria-live="polite" className="text-sm text-ink-soft" data-testid="online-state">
        Just nu: {online ? "du är online" : "du är offline"}.
      </p>

      {view.kind === "loading" && <p aria-busy="true">Kontrollerar…</p>}

      {view.kind === "unsupported" && (
        <p role="status" className="feedback feedback-wrong">
          Din webbläsare stöder inte offlineläge (cache och service worker saknas eller är avstängda, till exempel i privat läge). Utbildningen fungerar fortfarande online.
        </p>
      )}

      {view.kind === "idle" && (
        <>
          {view.hadBefore && <p className="feedback feedback-wrong">Tidigare nedladdning hittades inte längre (webbläsaren kan ha rensat den). Ladda ned igen.</p>}
          <button className="btn btn-primary" onClick={start} data-testid="offline-download" disabled={!online}>
            Gör utbildningen tillgänglig offline
          </button>
          {!online && <p className="text-sm">Du behöver vara online för att ladda ned.</p>}
        </>
      )}

      {view.kind === "downloading" && (
        <div className="space-y-2" data-testid="offline-progress">
          <p role="status">
            {view.progress.phase === "preparing" && "Förbereder nedladdning…"}
            {view.progress.phase === "downloading" && `Laddar ned: ${view.progress.done} av ${view.progress.total} filer (${formatBytes(view.progress.bytesDone)} av ${formatBytes(view.progress.bytesTotal)})`}
            {view.progress.phase === "verifying" && "Kontrollerar att allt är sparat…"}
          </p>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Nedladdning"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={view.progress.total ? Math.round((view.progress.done / view.progress.total) * 100) : 0}
          >
            <div className="progress-fill" style={{ width: `${view.progress.total ? (view.progress.done / view.progress.total) * 100 : 0}%` }} />
          </div>
          <button className="btn btn-small" onClick={() => abortRef.current?.abort()}>
            Avbryt
          </button>
        </div>
      )}

      {view.kind === "ready" && (
        <div className="space-y-3">
          <p role="status" className="feedback feedback-ok" data-testid="offline-ready">
            <strong>Klart för offline.</strong> {view.meta.fileCount} filer ({formatBytes(view.meta.bytes)}
            {view.meta.imageFiles !== undefined ? `, varav ${view.meta.imageFiles} bildfiler på ${formatBytes(view.meta.imageBytes ?? 0)}` : ""}) är sparade och kontrollerade {new Date(view.meta.readyAt).toLocaleString("sv-SE")}.
          </p>
          {view.updateAvailable && (
            <div className="callout callout-check space-y-2">
              <p>Det finns ett nyare innehåll. Dina framsteg påverkas inte.</p>
              <button className="btn btn-primary btn-small" onClick={start}>
                Uppdatera offlineinnehållet
              </button>
            </div>
          )}
          <button
            className="btn btn-small"
            onClick={async () => {
              await removeOffline();
              setView({ kind: "idle", hadBefore: false });
            }}
          >
            Ta bort offlineinnehållet från enheten
          </button>
        </div>
      )}

      {view.kind === "error" && (
        <div className="space-y-2" role="alert">
          <p className="feedback feedback-wrong">
            <strong>
              {view.errorKind === "insufficient-storage"
                ? "Otillräckligt lagringsutrymme."
                : view.errorKind === "cancelled"
                  ? "Nedladdningen avbröts."
                  : "Offlinenedladdningen blev inte klar."}
            </strong>{" "}
            {view.message}
            {view.errorKind === "insufficient-storage" && " Frigör utrymme på enheten och försök igen."}
          </p>
          <p className="text-sm">Utbildningen räknas inte som offlineklar förrän alla filer är sparade. Det som redan hämtats behålls, så nästa försök går snabbare.</p>
          <button className="btn btn-primary" onClick={start} disabled={!online}>
            {view.errorKind === "cancelled" || view.errorKind === "interrupted" ? "Fortsätt nedladdningen" : "Försök igen"}
          </button>
        </div>
      )}
    </section>
  );
}
