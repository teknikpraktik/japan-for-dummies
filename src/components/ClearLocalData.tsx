"use client";

import { useState } from "react";
import { progressStore } from "@/lib/store";
import { LAST_THEME_KEY } from "@/lib/last-theme";

/** Rensar de uppgifter som sparats lokalt av tjänsten: framsteg, pågående test och senast valt tema. */
export function ClearLocalData() {
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);

  function clear() {
    progressStore.replaceWith({ chapters: {}, favorites: [] });
    try {
      window.localStorage.removeItem(LAST_THEME_KEY);
    } catch {
      /* lagring otillgänglig */
    }
    setConfirm(false);
    setDone(true);
  }

  return (
    <section aria-labelledby="rensa" className="card space-y-3">
      <h2 id="rensa" className="!text-xl">Rensa lokala framsteg</h2>
      <p>Tar bort dina sparade framsteg, pågående test och senast valda tema från den här webbläsaren. Offlinenedladdningen ligger kvar tills du tar bort den ovan. Åtgärden kan inte ångras, så exportera först om du vill spara dem.</p>
      {done && (
        <p role="status" className="feedback feedback-ok" data-testid="cleared">
          Dina lokala framsteg är rensade.
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
    </section>
  );
}
