"use client";

import Link from "next/link";
import { chapterPath, themePath } from "@/lib/chapters";
import { chapterStatus, themeProgress } from "@/lib/progress";
import { useProgress } from "@/lib/store";
import { StatusBadge } from "./ChapterClient";
import type { ChapterLite } from "@/lib/chapter-lite";

export interface ThemeLite {
  id: string;
  order: number;
  title: string;
}

/** Progression först: sammanfattning, nästa kapitel, teman med publicerat innehåll och hopfällbara testresultat. */
export function MyProgress({ chapters, themes }: { chapters: ChapterLite[]; themes: ThemeLite[] }) {
  const { hydrated, state } = useProgress();
  if (!hydrated) return <div aria-busy="true" className="min-h-[14rem]" />;

  const published = chapters.filter((c) => c.status === "published");
  const done = published.filter((c) => chapterStatus(state, c.id) === "completed").length;
  const pct = published.length ? Math.round((done / published.length) * 100) : 0;
  const tp = new Map(themeProgress(state, chapters).map((t) => [t.themeId, t]));
  const rows = themes.filter((t) => (tp.get(t.id)?.published ?? 0) > 0);
  const results = published.filter((c) => state.chapters[c.id]?.best);

  return (
    <div className="space-y-6">
      <section aria-labelledby="sammanfattning" className="space-y-2">
        <h2 id="sammanfattning" className="!text-xl" data-testid="progress-summary">
          {done} av {published.length} tillgängliga kapitel klara
        </h2>
        <div className="progress-track" role="progressbar" aria-label="Klara kapitel" aria-valuemin={0} aria-valuemax={published.length} aria-valuenow={done} aria-valuetext={`${done} av ${published.length} klara`}>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </section>

      <section aria-labelledby="teman" className="space-y-2">
        <h2 id="teman" className="!text-xl">Per tema</h2>
        <ul className="space-y-2">
          {rows.map((t) => {
            const p = tp.get(t.id)!;
            const pct = Math.round((p.completed / p.published) * 100);
            return (
              <li key={t.id}>
                <Link href={themePath(t.id)} className="tile tile-link block !p-3 no-underline" style={{ color: "inherit" }} data-testid={`progress-theme-${t.id}`}>
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="font-semibold" style={{ color: "var(--color-indigo-dark)" }}>
                      {t.order}. {t.title}
                    </span>
                    <span className="text-sm text-ink-soft">{p.completed} av {p.published} klara</span>
                  </span>
                  <span className="progress-track mt-2 block" role="progressbar" aria-label={`Klara kapitel: ${t.title}`} aria-valuemin={0} aria-valuemax={p.published} aria-valuenow={p.completed}>
                    <span className="progress-fill block" style={{ width: `${pct}%` }} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {results.length > 0 && (
        <details className="tool" data-testid="results">
          <summary>Visa testresultat</summary>
          <div className="overflow-x-auto pt-2">
            <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
              <caption className="sr-only">Bästa testresultat per kapitel</caption>
              <thead>
                <tr className="border-b-2 border-line">
                  <th scope="col" className="py-2 pr-3">Kapitel</th>
                  <th scope="col" className="py-2 pr-3">Status</th>
                  <th scope="col" className="py-2">Bästa</th>
                </tr>
              </thead>
              <tbody>
                {results.map((c) => (
                  <tr key={c.id} className="border-b border-line align-top">
                    <th scope="row" className="py-2 pr-3 font-normal">
                      <Link href={chapterPath(c)}>{c.title}</Link>
                    </th>
                    <td className="py-2 pr-3"><StatusBadge chapterId={c.id} /></td>
                    <td className="py-2">{state.chapters[c.id]!.best!.score}/5</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
