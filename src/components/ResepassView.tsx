"use client";

import Link from "next/link";
import { chapterStatus, completedSinceExport, suggestNext, themeProgress } from "@/lib/progress";
import { useProgress } from "@/lib/store";
import type { ChapterLite } from "./ContinueCard";
import { TransferPanel } from "./TransferPanel";

export interface ThemeLite {
  id: string;
  order: number;
  title: string;
}

export function ResepassView({ chapters, themes }: { chapters: ChapterLite[]; themes: ThemeLite[] }) {
  const { hydrated, state } = useProgress();
  const published = chapters.filter((c) => c.status === "published");
  const completed = published.filter((c) => chapterStatus(state, c.id) === "completed");
  const started = published.filter((c) => chapterStatus(state, c.id) === "in-progress");
  const next = suggestNext(state, chapters) as ChapterLite | undefined;
  const favs = state.favorites.map((id) => chapters.find((c) => c.id === id)).filter((c): c is ChapterLite => Boolean(c));
  const tp = themeProgress(state, chapters);
  const unexported = completedSinceExport(state);

  if (!hydrated) return <p aria-busy="true">Hämtar ditt resepass…</p>;

  return (
    <div className="space-y-8">
      <section aria-labelledby="oversikt" className="grid gap-4 md:grid-cols-3">
        <h2 id="oversikt" className="sr-only">Sammanfattning</h2>
        <div className="card">
          <p className="text-3xl font-bold text-indigo-dark" data-testid="stat-completed">{completed.length} / {published.length}</p>
          <p>klara kapitel (av de färdiga)</p>
        </div>
        <div className="card">
          <p className="text-3xl font-bold text-indigo-dark" data-testid="stat-started">{started.length}</p>
          <p>påbörjade, inte klara</p>
        </div>
        <div className="card">
          <p className="text-3xl font-bold text-indigo-dark">{state.favorites.length}</p>
          <p>favoriter</p>
        </div>
      </section>

      <section aria-labelledby="nasta" className="card space-y-2">
        <h2 id="nasta">Nästa föreslagna kapitel</h2>
        {next ? (
          <p>
            <Link href={`/kapitel/${next.slug}/`} className="font-semibold">{next.title}</Link>
            {next.minutes ? ` (ca ${next.minutes} min)` : ""}
          </p>
        ) : (
          <p>Du har klarat alla färdiga kapitel. Fler kommer senare.</p>
        )}
      </section>

      {unexported > 0 && (
        <p className="callout callout-check" role="status">
          Du har {unexported} {unexported === 1 ? "klart kapitel" : "klara kapitel"} sedan senaste export. <a href="#export">Exportera dina framsteg</a> så att de inte försvinner om webbdata rensas.
        </p>
      )}

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
                    {p.published > 0 ? `${p.completed} av ${p.published} färdiga klara` : "Inga färdiga kapitel än"} · {p.planned} kommer senare
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
            <caption className="sr-only">Bästa och senaste testresultat per färdigt kapitel</caption>
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

      <section aria-labelledby="favoriter" className="space-y-2">
        <h2 id="favoriter">Favoriter</h2>
        {favs.length === 0 ? (
          <p>Du har inga favoriter än. Öppna ett kapitel och välj ”Favoritmarkera”.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-6">
            {favs.map((c) => (
              <li key={c.id}><Link href={`/kapitel/${c.slug}/`}>{c.title}</Link></li>
            ))}
          </ul>
        )}
      </section>

      <TransferPanel />

      <p className="text-sm text-ink-soft">
        Framstegen sparas bara i den här webbläsaren. <Link href="/info/">Läs om hur lagringen fungerar.</Link>
      </p>
    </div>
  );
}
