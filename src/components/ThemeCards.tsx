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

const kapitel = (n: number) => `${n} kapitel`;
const slutforda = (n: number) => `${n} ${n === 1 ? "slutfört" : "slutförda"}`;

/**
 * Alla teman som kort. Tillgängligt innehåll (publicerade kapitel) och användarens progression hålls isär:
 * ”N kapitel tillgängliga · M slutförda”. Teman utan publicerade kapitel är märkta ”Kommer senare”, utan
 * framstegsindikator, men går att öppna eftersom temasidan visar en kapitelöversikt (titlar, beskrivningar, mål).
 */
export function ThemeCards({ themes, chapters }: { themes: ThemeCardData[]; chapters: ChapterRef[] }) {
  const { hydrated, state } = useProgress();
  const prog = new Map(themeProgress(state, chapters).map((p) => [p.themeId, p]));
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {themes.map((t) => {
        const p = prog.get(t.id);
        const available = p?.published ?? 0;
        const done = hydrated ? (p?.completed ?? 0) : 0;
        const pct = available > 0 ? Math.round((done / available) * 100) : 0;
        const upcoming = available === 0;
        return (
          <li key={t.id} className={`tile tile-link flex flex-col ${upcoming ? "tile-upcoming" : ""}`} data-testid={`theme-card-${t.id}`}>
            <p className="text-sm font-bold text-ink-soft">Tema {t.order}</p>
            <h3 className="text-base leading-snug">
              <Link href={t.href} className="no-underline after:absolute after:inset-0 after:content-['']" style={{ color: "var(--color-indigo-dark)" }}>
                {t.title}
              </Link>
            </h3>
            <div className="mt-auto pt-2">
              {upcoming ? (
                <p className="text-sm text-ink-soft">Kommer senare</p>
              ) : (
                <>
                  <div className="progress-track" role="progressbar" aria-label={`Slutförda kapitel i tema ${t.order}`} aria-valuemin={0} aria-valuemax={available} aria-valuenow={done} aria-valuetext={`${done} av ${available} slutförda`}>
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-sm text-ink-soft" data-testid={`theme-card-count-${t.id}`}>
                    {kapitel(available)}
                    {hydrated ? ` · ${slutforda(done)}` : ""}
                  </p>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
