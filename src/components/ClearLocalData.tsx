"use client";

import { useState } from "react";
import { progressStore } from "@/lib/store";
import { LAST_CHAPTER_KEY, LAST_THEME_KEY } from "@/lib/last-theme";
import { offlineStore, useOfflineStatus } from "@/lib/offline-store";

/** Hantera lagring: rensa framsteg och ta bort offlinematerial är två skilda åtgärder. */
export function ManageStorage() {
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const offline = useOfflineStatus();

  function clear() {
    progressStore.replaceWith({ chapters: {}, favorites: [] });
    try {
      window.localStorage.removeItem(LAST_THEME_KEY);
      window.localStorage.removeItem(LAST_CHAPTER_KEY);
    } catch {
      /* lagring otillgänglig */
    }
    setConfirm(false);
    setDone(true);
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-2">
        <p className="font-semibold">Rensa framsteg</p>
        <p>Tar bort dina framsteg, pågående test och senast valda tema i den här webbläsaren. Offlinematerialet påverkas inte. Åtgärden kan inte ångras, så exportera först om du vill spara en kopia.</p>
        {done && (
          <p role="status" className="feedback feedback-ok" data-testid="cleared">
            Dina framsteg är rensade.
          </p>
        )}
        {!confirm ? (
          <button className="btn btn-small" onClick={() => { setDone(false); setConfirm(true); }} data-testid="clear-start">
            Rensa mina framsteg…
          </button>
        ) : (
          <div className="space-y-2" role="alertdialog" aria-labelledby="rensa-fraga">
            <p id="rensa-fraga" className="font-semibold">Vill du verkligen rensa alla framsteg på den här enheten?</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-small" onClick={() => setConfirm(false)}>Avbryt</button>
              <button className="btn btn-danger btn-small" onClick={clear} data-testid="clear-confirm">Ja, rensa</button>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <p className="font-semibold">Ta bort offlinematerial</p>
        {offline.kind === "ready" ? (
          <>
            <p>Tar bort det nedladdade utbildningsmaterialet från enheten. Dina framsteg påverkas inte.</p>
            <button className="btn btn-small" onClick={() => void offlineStore.remove()} data-testid="offline-remove">
              Ta bort offlinematerialet
            </button>
          </>
        ) : (
          <p className="text-ink-soft">Inget offlinematerial är nedladdat.</p>
        )}
      </div>
    </div>
  );
}
