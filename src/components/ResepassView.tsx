"use client";

import Link from "next/link";
import { chapterStatus, suggestNext, themeProgress } from "@/lib/progress";
import { useProgress } from "@/lib/store";
import type { ChapterLite } from "@/lib/chapter-lite";
import { TransferPanel } from "./TransferPanel";

export interface ThemeLite {
  id: string;
  order: number;
  title: string;
}

export function ResepassView({ chapters, themes, showTransfer = true }: { chapters: ChapterLite[]; themes: ThemeLite[]; showTransfer?: boolean }) {
  const { hydrated, state } = useProgress();
  const published = chapters.filter((c) => c.status === "published");
  const completed = published.filter((c) => chapterStatus(state, c.id) === "completed");
  const started = published.filter((c) => chapterStatus(state, c.id) === "in-progress");
  const next = suggestNext(state, chapters) as ChapterLite | undefined;
  const tp = themeProgress(state, chapters);

  if (!hydrated) return <p aria-busy="true">Hämtar ditt resepass…</p>;

  return (
    <div className="space-y-8">
      <section aria-labelledby="oversikt" className="grid gap-4 sm:grid-cols-2">
        <h2 id="oversikt" className="sr-only">Sammanfattning</h2>
        <div className="card">
          <p className="text-3xl font-bold text-indigo-dark" data-testid="stat-completed">{completed.length} / {published.length}</p>
          <p>klara kapitel</p>
        </div>
        <div className="card">
          <p className="text-3xl font-bold text-indigo-dark" data-testid="stat-started">{started.length}</p>
          <p>påbörjade, inte klara</p>
        </div>
      </section>

      <section aria-labelledby="nasta" className="card space-y-2">
        <h2 id="nasta">Nästa föreslagna kapitel</h2>
        {next ? (
          <p>
            <Link href={`/kapitel/${next.slug}/`} className="font-semibold">{next.title}</Link>
          </p>
        ) : (
          <p>Du har klarat alla kapitel.</p>
        )}
      </section>

      <section aria-labelledby="teman" className="space-y-3">
        <h2 id="teman">Framsteg per tema</h2>
        <ul className="space-y-3">
          {themes.map((t) => {
            const p = tp.find((x) => x.themeId === t.id)!;
            const pct = p.published ? Math.round((p.completed / p.published) * 100) : 0;
            return (
              <li key={t.id} className="card !p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{t.order}. {t.title}</p>
                  <p className="text-sm text-ink-soft">
                    {p.published > 0 ? `${p.completed} av ${p.published} klara` : "Inga kapitel än"} · {p.planned} kommer senare
                  </p>
                </div>
                <div className="progress-track mt-2" role="progressbar" aria-label={`Framsteg ${t.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="resultat" className="space-y-3">
        <h2 id="resultat">Testresultat</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-left">
            <caption className="sr-only">Bästa och senaste testresultat per kapitel</caption>
            <thead>
              <tr className="border-b-2 border-line">
                <th scope="col" className="py-2 pr-3">Kapitel</th>
                <th scope="col" className="py-2 pr-3">Status</th>
                <th scope="col" className="py-2 pr-3">Bästa</th>
                <th scope="col" className="py-2">Senaste</th>
              </tr>
            </thead>
            <tbody>
              {published.map((c) => {
                const p = state.chapters[c.id];
                const st = chapterStatus(state, c.id);
                return (
                  <tr key={c.id} className="border-b border-line">
                    <th scope="row" className="py-2 pr-3 font-normal"><Link href={`/kapitel/${c.slug}/`}>{c.title}</Link></th>
                    <td className="py-2 pr-3">{st === "completed" ? "✓ Klar" : st === "in-progress" ? "Påbörjad" : "Ej påbörjad"}</td>
                    <td className="py-2 pr-3">{p?.best ? `${p.best.score}/5` : "–"}</td>
                    <td className="py-2">{p?.last ? `${p.last.score}/5` : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {showTransfer && <TransferPanel />}

    </div>
  );
}
