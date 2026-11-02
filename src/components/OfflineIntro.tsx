"use client";

import Link from "next/link";
import { formatBytes } from "@/lib/offline";
import { offlineStore, useOfflineStatus } from "@/lib/offline-store";

/** Kort offlineruta vid startsidans introduktion. Samma funktion och status som sidhuvudet och sidan Offline och framsteg. */
export function OfflineIntro() {
  const v = useOfflineStatus();
  if (v.kind === "loading" || v.kind === "unsupported") return <div className="min-h-[3.25rem]" aria-hidden="true" />;
  const pct = v.kind === "downloading" && v.progress.total > 0 ? Math.round((v.progress.done / v.progress.total) * 100) : 0;
  return (
    <div className="min-h-[3.25rem] text-sm text-ink-soft" data-testid="offline-intro" aria-live="polite">
      {v.kind === "idle" && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button className="btn btn-small" onClick={() => void offlineStore.start()} data-testid="intro-download">
            Ladda ned för offline
          </button>
          <span>
            Hela utbildningen{v.info ? `, cirka ${formatBytes(v.info.bytes)}` : ""}. <Link href="/offline/">Mer om offline</Link>
          </span>
        </p>
      )}
      {v.kind === "downloading" && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="intro-progress">
          <span>{v.progress.phase === "verifying" ? "Kontrollerar att allt är sparat…" : v.progress.total > 0 ? `Laddar ned ${pct} %` : "Förbereder nedladdning…"}</span>
          <span className="progress-track w-32" role="progressbar" aria-label="Nedladdning" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <span className="progress-fill block" style={{ width: `${pct}%` }} />
          </span>
          <button className="btn btn-small" onClick={() => offlineStore.cancel()}>
            Avbryt
          </button>
        </p>
      )}
      {v.kind === "ready" && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-ok" data-testid="intro-ready">
            Tillgänglig offline ✓
          </span>
          {v.updateAvailable && (
            <button className="btn btn-small" onClick={() => void offlineStore.start()}>
              Uppdatera materialet
            </button>
          )}
          <Link href="/offline/">Mer om offline</Link>
        </p>
      )}
      {v.kind === "error" && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1" role="alert">
          <span>{v.errorKind === "insufficient-storage" ? "Otillräckligt lagringsutrymme." : "Nedladdningen blev inte klar."}</span>
          <button className="btn btn-small" onClick={() => void offlineStore.start()}>
            Försök igen
          </button>
        </p>
      )}
    </div>
  );
}
