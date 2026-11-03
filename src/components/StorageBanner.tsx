"use client";

import { progressStore, useProgress } from "@/lib/store";

export function StorageBanner() {
  const { hydrated, status } = useProgress();
  if (!hydrated || status === "ok") return null;
  const msg =
    status === "unavailable"
      ? "Din webbläsare tillåter inte lokal lagring (till exempel i privat läge). Du kan använda utbildningen, men framstegen finns bara tills du stänger fliken. Exportera under Mina framsteg om du vill spara dem."
      : status === "write-failed"
        ? "Det gick inte att spara dina framsteg på enheten (utrymmet kan vara fullt). Exportera dina framsteg under Mina framsteg så att inget går förlorat."
        : "Sparade framsteg gick inte att läsa (filen var skadad). En säkerhetskopia av den skadade texten finns kvar i webbläsaren och appen har börjat om med tomma framsteg. Du kan importera en tidigare exportfil under Mina framsteg.";
  return (
    <div role="alert" className="border-b border-[#e7cf8f] bg-warn-soft">
      <div className="container-page flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
        <p className="max-w-3xl">{msg}</p>
        {status === "recovered" && (
          <button className="btn btn-small" onClick={() => progressStore.dismissRecovered()}>
            Stäng
          </button>
        )}
      </div>
    </div>
  );
}
