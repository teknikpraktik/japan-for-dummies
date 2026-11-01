"use client";

import { useCallback, useEffect, useState } from "react";

interface Cell { status: "none" | "started" | "completed"; selfReported: boolean; outdated: boolean }
interface Row { userId: string; displayName: string; username: string | null; active: boolean; completedCount: number; cells: Cell[]; lastSyncedAt: string | null }
interface Data { group: string; publishedCount: number; chapters: { id: string; title: string }[]; rows: Row[] }

const label = { none: "Ej påbörjat", started: "Påbörjat", completed: "Avklarat" } as const;
const icon = { none: "○", started: "◐", completed: "●" } as const;
const tone = { none: "text-ink-soft", started: "text-indigo-dark", completed: "text-ok" } as const;

export function TeacherMatrix() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/lararen/oversikt/", { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) return setError(r.status === 401 ? "Du har blivit utloggad. Logga in igen." : "Kunde inte hämta översikten.");
      setData((await r.json()) as Data);
      setError(null);
    } catch {
      setError("Det gick inte att nå servern. Läraröversikten kräver internet.");
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- datahämtning vid montering
    void load();
  }, [load]);
  if (error) return <p role="alert" className="feedback feedback-wrong prose-col">{error}</p>;
  if (!data) return <p aria-busy="true">Hämtar översikten…</p>;
  return (
    <div className="space-y-3">
      <p className="text-ink-soft">
        Grupp <strong>{data.group}</strong>: {data.rows.length} elever och {data.publishedCount} publicerade kapitel. De {60 - data.publishedCount} kommande kapitlen räknas inte.
      </p>
      <p className="text-sm" aria-label="Teckenförklaring">
        <span className="mr-4"><span aria-hidden="true">○</span> Ej påbörjat</span>
        <span className="mr-4"><span aria-hidden="true">◐</span> Påbörjat</span>
        <span className="mr-4"><span aria-hidden="true">●</span> Avklarat</span>
        <span className="mr-4">* självrapporterat (import)</span>
        <span>† kapitlet har uppdaterats efter att det blev avklarat</span>
      </p>
      <div className="relative overflow-x-auto rounded-xl border border-line bg-card" tabIndex={0} role="region" aria-label="Framstegsmatris, rulla i sidled vid behov">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm" data-testid="matrix">
          <caption className="sr-only">Elevernas status per publicerat kapitel</caption>
          <thead>
            <tr className="border-b-2 border-line">
              <th scope="col" className="sticky left-0 bg-card p-2">Elev</th>
              {data.chapters.map((c, i) => (
                <th key={c.id} scope="col" className="p-2 align-bottom" title={c.title}>
                  <span className="sr-only">{c.title}</span>
                  <span aria-hidden="true">K{i + 1}</span>
                </th>
              ))}
              <th scope="col" className="p-2">Avklarat</th>
              <th scope="col" className="p-2">Senast synkad</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={data.chapters.length + 3} className="p-3 text-ink-soft">Inga elever ännu. Skapa elever under Elever.</td>
              </tr>
            )}
            {data.rows.map((r) => (
              <tr key={r.userId} className="border-b border-line" data-testid={`row-${r.displayName}`}>
                <th scope="row" className="sticky left-0 bg-card p-2 font-semibold">
                  {r.displayName}
                  <span className="block text-xs font-normal text-ink-soft">{r.username}{r.active ? "" : " (avaktiverad)"}</span>
                </th>
                {r.cells.map((c, i) => (
                  <td key={i} className={`p-2 text-center ${tone[c.status]}`} data-status={c.status}>
                    <span aria-hidden="true">{icon[c.status]}{c.selfReported && c.status === "completed" ? "*" : ""}{c.outdated ? "†" : ""}</span>
                    <span className="sr-only">
                      {data.chapters[i].title}: {label[c.status]}
                      {c.selfReported && c.status === "completed" ? ", självrapporterat" : ""}
                      {c.outdated ? ", kapitlet har uppdaterats efter att det blev avklarat" : ""}
                    </span>
                  </td>
                ))}
                <td className="p-2 font-semibold" data-testid="count">{r.completedCount} av {data.publishedCount}</td>
                <td className="p-2 text-ink-soft">{r.lastSyncedAt ? new Date(r.lastSyncedAt).toLocaleString("sv-SE") : "Aldrig"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-ink-soft">
        Tidpunkten visar när elevens framsteg senast synkades, inte när eleven var aktiv. Framsteg som skapats offline är en pedagogisk bekvämlighet och inte ett manipulationssäkert betygsunderlag. <button className="underline" onClick={() => void load()}>Uppdatera</button>
      </p>
    </div>
  );
}
