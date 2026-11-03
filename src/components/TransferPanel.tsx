"use client";

import { useRef, useState } from "react";
import { buildExport, exportFilename, parseImport, MAX_IMPORT_BYTES } from "@/lib/transfer";
import { progressStore, useProgress } from "@/lib/store";
import type { ProgressState } from "@/lib/progress";

type Pending = { data: Pick<ProgressState, "chapters" | "favorites">; count: number; favs: number };

export function TransferPanel() {
  const { hydrated, state } = useProgress();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  function doExport() {
    const now = new Date();
    const blob = new Blob([JSON.stringify(buildExport(state, now), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFilename(now);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    progressStore.setLastExport(now.toISOString());
    setMessage({ kind: "ok", text: `Framstegen exporterades till filen ${exportFilename(now)}. Spara den på ett säkert ställe.` });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setPending(null);
    setConfirmReplace(false);
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setMessage({ kind: "error", text: `Filen är för stor (${Math.round(file.size / 1024)} kB). Inget har ändrats.` });
      return;
    }
    const text = await file.text();
    const result = parseImport(text, file.size);
    if (!result.ok) {
      setMessage({ kind: "error", text: `${result.error} Inget har ändrats.` });
      return;
    }
    setMessage(null);
    setPending({ data: result.data, count: Object.keys(result.data.chapters).length, favs: result.data.favorites.length });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm">Exportera en fil som säkerhetskopia eller för att flytta framstegen till en annan webbläsare eller enhet. Filen innehåller bara dina kapitelframsteg.</p>
      {hydrated && state.lastExportAt && (
        <p className="text-sm text-ink-soft">
          Senaste export: <span data-testid="last-export">{new Date(state.lastExportAt).toLocaleString("sv-SE")}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={doExport} disabled={!hydrated} data-testid="export">
          Exportera framsteg
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()} data-testid="import-button">
          Importera framsteg…
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={onFile} aria-label="Välj exportfil att importera" data-testid="import-input" />
      </div>
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={`feedback ${message.kind === "ok" ? "feedback-ok" : "feedback-wrong"}`} data-testid="transfer-message">
          {message.text}
        </p>
      )}
      {pending && (
        <div className="callout space-y-3" role="group" aria-label="Importera framsteg" data-testid="import-choice">
          <p>
            Filen är giltig och innehåller {pending.count} kapitel med framsteg och {pending.favs} favoriter. Vad vill du göra?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-primary"
              onClick={() => {
                progressStore.mergeIn(pending.data);
                setPending(null);
                setMessage({ kind: "ok", text: "Framstegen slogs samman med dina nuvarande. Bästa resultat och klara kapitel behölls." });
              }}
              data-testid="import-merge"
            >
              Slå samman (rekommenderas)
            </button>
            {!confirmReplace ? (
              <button className="btn btn-danger" onClick={() => setConfirmReplace(true)} data-testid="import-replace">
                Ersätt mina framsteg…
              </button>
            ) : (
              <span className="flex flex-wrap items-center gap-2" role="alert">
                <strong>Alla nuvarande framsteg och favoriter tas bort och ersätts av filens. Det går inte att ångra.</strong>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    progressStore.replaceWith(pending.data);
                    setPending(null);
                    setConfirmReplace(false);
                    setMessage({ kind: "ok", text: "Dina framsteg ersattes med innehållet i filen." });
                  }}
                  data-testid="import-replace-confirm"
                >
                  Ja, ersätt
                </button>
                <button className="btn" onClick={() => setConfirmReplace(false)}>
                  Avbryt
                </button>
              </span>
            )}
            <button
              className="btn"
              onClick={() => {
                setPending(null);
                setConfirmReplace(false);
              }}
            >
              Avbryt import
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
