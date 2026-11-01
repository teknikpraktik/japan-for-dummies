"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isCompleted } from "@/lib/progress";
import { useProgress } from "@/lib/store";

export interface NavChapter {
  id: string;
  title: string;
  order: number;
  published: boolean;
  href: string;
}
export interface NavTheme {
  id: string;
  order: number;
  title: string;
  href: string;
  chapters: NavChapter[];
}

/**
 * Tema- och kapitelnavigation för utbildningen. En enda DOM-struktur: fast vänsterspalt på stora skärmar,
 * panel (öppnas med knappen ”Teman och kapitel”) på små. Data kommer från innehållet, inget är hårdkodat här.
 */
export function EducationNav({ themes, activeThemeId }: { themes: NavTheme[]; activeThemeId: string }) {
  const { hydrated, state } = useProgress();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([activeThemeId]));
  const openerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const active = themes.find((t) => t.id === activeThemeId) ?? themes[0];

  // Det aktiva temat är alltid utfällt när det byts (t.ex. med bakåtknappen).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synkar utfällning med adressen
    setExpanded((prev) => (prev.has(activeThemeId) ? prev : new Set(prev).add(activeThemeId)));
    setOpen(false);
  }, [activeThemeId]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        openerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <div className="lg:hidden">
        <button
          ref={openerRef}
          type="button"
          className="btn w-full justify-between"
          aria-expanded={open}
          aria-controls="utbildning-nav"
          onClick={() => setOpen(true)}
          data-testid="nav-open"
        >
          <span>Teman och kapitel</span>
          <span className="text-sm font-normal text-ink-soft">
            Tema {active.order}: {active.title}
          </span>
        </button>
      </div>

      {open && <button type="button" tabIndex={-1} aria-label="Stäng panelen" className="fixed inset-0 z-[60] bg-ink/40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        id="utbildning-nav"
        aria-label="Teman och kapitel"
        className={
          open
            ? "fixed inset-y-0 left-0 z-[70] block w-[min(88vw,20rem)] overflow-y-auto border-r border-line bg-card p-4 shadow-xl lg:static lg:z-auto lg:w-auto lg:border-r-0 lg:bg-transparent lg:p-0 lg:shadow-none"
            : "hidden lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:rounded-xl lg:border lg:border-line lg:bg-card lg:p-3"
        }
        data-testid="education-nav"
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="px-1 text-sm font-bold uppercase tracking-wide text-ink-soft">Teman</p>
          {open && (
            <button ref={closeRef} type="button" className="btn btn-small lg:hidden" onClick={() => { setOpen(false); openerRef.current?.focus(); }}>
              Stäng
            </button>
          )}
        </div>
        <ol className="space-y-0.5">
          {themes.map((t) => {
            const isActive = t.id === active.id;
            const isOpen = expanded.has(t.id);
            const listId = `nav-ch-${t.id}`;
            return (
              <li key={t.id}>
                <div className={`flex items-stretch rounded-lg ${isActive ? "bg-indigo-soft" : ""}`}>
                  <Link
                    href={t.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex-1 rounded-lg px-2 py-2 text-[0.95rem] leading-snug no-underline ${isActive ? "font-bold text-indigo-dark" : "text-ink hover:bg-paper-2"}`}
                    data-testid={`nav-theme-${t.id}`}
                  >
                    <span className="mr-1.5 tabular-nums text-ink-soft">{t.order}.</span>
                    {t.title}
                  </Link>
                  <button
                    type="button"
                    className="flex w-10 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-paper-2"
                    aria-expanded={isOpen}
                    aria-controls={listId}
                    aria-label={`Kapitel i tema ${t.order}, ${t.title}`}
                    onClick={() => toggle(t.id)}
                    data-testid={`nav-toggle-${t.id}`}
                  >
                    <span aria-hidden="true" className={`inline-block transition-transform ${isOpen ? "rotate-90" : ""}`}>▸</span>
                  </button>
                </div>
                <ul id={listId} hidden={!isOpen} className="mb-1 ml-3 space-y-0.5 border-l border-line pl-2">
                  {t.chapters.map((c) => {
                    const done = hydrated && c.published && isCompleted(state, c.id);
                    return (
                      <li key={c.id} className="text-sm leading-snug">
                        {c.published ? (
                          <Link href={c.href} onClick={() => setOpen(false)} className="flex items-baseline gap-1.5 rounded-md px-2 py-1.5 no-underline hover:bg-paper-2" data-testid={`nav-chapter-${c.id}`}>
                            <span>{c.title}</span>
                            {done && (
                              <span className="text-ok" data-testid={`nav-done-${c.id}`}>
                                <span aria-hidden="true">✓</span>
                                <span className="sr-only"> Slutfört</span>
                              </span>
                            )}
                          </Link>
                        ) : (
                          <span className="flex flex-wrap items-baseline gap-x-1.5 px-2 py-1.5 text-ink-soft" data-testid={`nav-planned-${c.id}`}>
                            <span>{c.title}</span>
                            <span className="text-xs">Kommer senare</span>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
      </aside>
    </>
  );
}
