"use client";

import { useState, useSyncExternalStore } from "react";
import { parseStoredState } from "@/lib/progress";
import { LEGACY_STORAGE_KEY, acctPrefix } from "@/lib/storage";
import { progressStore, useProgress } from "@/lib/store";
import { pull } from "@/lib/sync";
import type { ChapterLite } from "@/lib/chapter-lite";

function readLegacy() {
  try {
    const parsed = parseStoredState(window.localStorage.getItem(LEGACY_STORAGE_KEY));
    return parsed && parsed !== "empty" ? parsed : null;
  } catch {
    return null;
  }
}
const noop = () => () => {};

/**
 * Äldre lokala framsteg (från före inloggning) importeras ALDRIG automatiskt. Eleven ser en förhandsgranskning och
 * bekräftar uttryckligen. Importen är självrapporterad, markeras så för läraren och kan upprepas utan dubbletter.
 */
export function LegacyImportPanel({ userId, chapters }: { userId: string; chapters: ChapterLite[] }) {
  const { scope } = useProgress();
  const legacyRaw = useSyncExternalStore(noop, () => (readLegacy() ? window.localStorage.getItem(LEGACY_STORAGE_KEY) : null), () => null);
  const [done, setDone] = useState<null | { imported: number; skipped: number }>(null);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);
  if (scope.kind !== "account" || scope.userId !== userId || !legacyRaw || cleared) return null;
  const legacy = readLegacy();
  if (!legacy) return null;
  const published = new Map(chapters.filter((c) => c.status === "published").map((c) => [c.id, c]));
  const items = Object.entries(legacy.chapters)
    .filter(([id]) => published.has(id))
    .map(([id, p]) => ({ chapterId: id, contentVersion: p.contentVersion, completed: Boolean(p.completedAt), completedAt: p.completedAt, title: published.get(id)!.title }));
  if (items.length === 0 || dismissed) return null;

  async function importNow() {
    setError(null);
    try {
      const res = await fetch("/api/framsteg/importera/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        body: JSON.stringify({ confirm: true, chapters: items.map(({ title: _t, ...i }) => i) }),
      });
      if (!res.ok) return setError("Importen misslyckades. Kontrollera att du är online och inloggad och försök igen.");
      const d = (await res.json()) as { imported: number; skipped: number };
      setDone({ imported: d.imported, skipped: d.skipped });
      await pull();
    } catch {
      setError("Det gick inte att nå servern. Importen kräver internet.");
    }
  }

  return (
    <section aria-labelledby="legacy" className="card space-y-3" data-testid="legacy-panel">
      <h2 id="legacy" className="!text-xl">Äldre framsteg hittades på den här enheten</h2>
      <p>
        Det finns framsteg som sparats i den här webbläsaren från före inloggningen. De är <strong>inte kopplade till något konto</strong> och kan ha gjorts av vem som helst som använt enheten. Granska listan. Inget importeras om du inte bekräftar.
      </p>
      <ul className="list-disc space-y-1 pl-6">
        {items.map((i) => (
          <li key={i.chapterId}>
            {i.title}: {i.completed ? "Avklarat" : "Påbörjat"}
            {i.completedAt ? ` (${new Date(i.completedAt).toLocaleDateString("sv-SE")})` : ""}
          </li>
        ))}
      </ul>
      <p className="callout callout-check">Importerade framsteg är <strong>självrapporterade</strong>. De markeras så för din lärare tills du gör kapiteltestet inloggad.</p>
      {error && <p role="alert" className="feedback feedback-wrong">{error}</p>}
      {done ? (
        <div className="space-y-2" role="status">
          <p className="feedback feedback-ok" data-testid="legacy-done">Klart: {done.imported} kapitel importerades{done.skipped ? ` (${done.skipped} hoppades över)` : ""}. Att importera igen skapar inga dubbletter.</p>
          <button
            className="btn btn-small"
            onClick={() => {
              try {
                window.localStorage.removeItem(LEGACY_STORAGE_KEY);
              } catch {
                /* ignorera */
              }
              setCleared(true);
            }}
          >
            Ta bort de äldre lokala framstegen från den här enheten
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => void importNow()} data-testid="legacy-import">Importera till mitt konto</button>
          <button className="btn" onClick={() => setDismissed(true)} data-testid="legacy-skip">Importera inte</button>
        </div>
      )}
      <p className="sr-only">{acctPrefix(userId) && progressStore.currentScope().kind}</p>
    </section>
  );
}
