"use client";

import Link from "next/link";
import { themeProgress, type ChapterRef } from "@/lib/progress";
import { useProgress } from "@/lib/store";

export interface ThemeCardData {
  id: string;
  order: number;
  title: string;
  href: string;
}

/** Alla teman med egen framstegsindikator. Skalar till valfritt antal kapitel eftersom varje tema är ett kort. */
export function ThemeCards({ themes, chapters }: { themes: ThemeCardData[]; chapters: ChapterRef[] }) {
  const { hydrated, state } = useProgress();
  const prog = new Map(themeProgress(state, chapters).map((p) => [p.themeId, p]));
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {themes.map((t) => {
        const p = prog.get(t.id);
        const published = p?.published ?? 0;
        const completed = hydrated ? (p?.completed ?? 0) : 0;
        const pct = published > 0 ? Math.round((completed / published) * 100) : 0;
        return (
          <li key={t.id} className="relative rounded-xl border border-line bg-card p-3 transition-colors focus-within:border-indigo focus-within:outline focus-within:outline-2 focus-within:outline-indigo hover:border-indigo hover:bg-paper-2" data-testid={`theme-card-${t.id}`}>
            <p className="text-sm font-bold text-ink-soft">Tema {t.order}</p>
            <h3 className="text-base leading-snug">
              <Link href={t.href} className="no-underline after:absolute after:inset-0 after:content-['']" style={{ color: "var(--color-indigo-dark)" }}>
                {t.title}
              </Link>
            </h3>
            {published > 0 ? (
              <>
                <div className="progress-track mt-2" role="progressbar" aria-label={`Klara kapitel i tema ${t.order}`} aria-valuemin={0} aria-valuemax={published} aria-valuenow={completed} aria-valuetext={`${completed} av ${published} klara`}>
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-sm text-ink-soft">{hydrated ? `${completed} av ${published} klara` : `${published} kapitel`}</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">Kommer senare</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
