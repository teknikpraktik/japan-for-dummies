"use client";

import { useEffect, useState } from "react";
import { formatBytes } from "@/lib/offline";
import { offlineStore, useOfflineStatus } from "@/lib/offline-store";

/** Kompakt offlinesektion. Visar bara det som är relevant för nuvarande status; detaljer behålls internt för verifiering. */
export function OfflinePanel() {
  const view = useOfflineStatus();
  const start = () => void offlineStore.start();
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

  return (
    <section aria-labelledby="offline-rubrik" id="offline" className="card space-y-2">
      <h2 id="offline-rubrik" className="!text-xl">Offline</h2>

      {view.kind === "loading" && <p aria-busy="true" className="text-sm text-ink-soft">Kontrollerar…</p>}

      {view.kind === "unsupported" && (
        <p role="status" className="text-sm">
          Din webbläsare stöder inte offlineläge (till exempel i privat läge). Utbildningen fungerar fortfarande online.
        </p>
      )}

      {view.kind === "idle" && (
        <>
          {view.hadBefore && <p className="feedback feedback-wrong">Tidigare nedladdning hittades inte längre (webbläsaren kan ha rensat den). Ladda ned igen.</p>}
          <p>
            Ladda ned utbildningen för att kunna använda den utan internet.
            {view.info ? <span data-testid="offline-size"> Nedladdningen är cirka {formatBytes(view.info.bytes)}.</span> : null}
          </p>
          <button className="btn btn-primary" onClick={start} data-testid="offline-download" disabled={!online}>
            Ladda ned utbildningen
          </button>
          {!online && <p className="text-sm">Du behöver vara online för att ladda ned.</p>}
        </>
      )}

      {view.kind === "downloading" && (
        <div className="space-y-2" data-testid="offline-progress">
          <p role="status">
            {view.progress.phase === "preparing" && "Förbereder nedladdning…"}
            {view.progress.phase === "downloading" && `Laddar ned ${view.progress.total ? Math.round((view.progress.done / view.progress.total) * 100) : 0} % (${formatBytes(view.progress.bytesDone)} av ${formatBytes(view.progress.bytesTotal)})`}
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
          <button className="btn btn-small" onClick={() => offlineStore.cancel()}>
            Avbryt
          </button>
        </div>
      )}

      {view.kind === "ready" && (
        <div className="space-y-2">
          <p role="status" data-testid="offline-ready">
            <strong className="text-ok">Tillgänglig offline ✓</strong>
            <br />
            Du kan använda det nedladdade materialet utan internet.
          </p>
          {view.updateAvailable && (
            <div className="callout callout-check space-y-2">
              <p>Det finns nytt innehåll. Dina framsteg påverkas inte.</p>
              <button className="btn btn-primary btn-small" onClick={start}>
                Uppdatera
              </button>
            </div>
          )}
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
                  : "Nedladdningen blev inte klar."}
            </strong>{" "}
            {view.message}
            {view.errorKind === "insufficient-storage" && " Frigör utrymme på enheten och försök igen."}
          </p>
          <p className="text-sm">Det som redan hämtats behålls, så nästa försök går snabbare. Materialet räknas inte som nedladdat förrän allt är sparat.</p>
          <button className="btn btn-primary" onClick={start} disabled={!online}>
            Försök igen
          </button>
        </div>
      )}
    </section>
  );
}
