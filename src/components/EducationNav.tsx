"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { writeLastTheme } from "@/lib/last-theme";
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
const norm = (p: string) => (p.endsWith("/") ? p : p + "/");

export function EducationNav({ themes }: { themes: NavTheme[] }) {
  const { hydrated, state } = useProgress();
  const pathname = norm(usePathname() ?? "/");
  // Aktivt tema/kapitel härleds ur adressen: temasida eller kapitelsida. /utbildning/ utan tema har inget aktivt.
  const activeChapter = themes.flatMap((t) => t.chapters.map((c) => ({ c, t }))).find(({ c }) => c.href === pathname);
  const activeTheme = activeChapter?.t ?? themes.find((t) => t.href === pathname);
  const activeThemeId = activeTheme?.id;
  const onThemePage = !activeChapter && !!activeTheme;

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(activeThemeId ? [activeThemeId] : []));
  const openerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const focusContentAfterNav = useRef(false);
  const firstRender = useRef(true);

  // Vid sidbyte: öppna aktivt tema, stäng panelen, kom ihåg temat och flytta fokus om panelen användes.
  useEffect(() => {
    if (activeThemeId) {
      writeLastTheme(activeThemeId);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synkar utfällning med adressen
      setExpanded((prev) => (prev.has(activeThemeId) ? prev : new Set(prev).add(activeThemeId)));
    }
    setOpen(false);
    if (firstRender.current) {
      firstRender.current = false;
    } else if (focusContentAfterNav.current) {
      const target = document.querySelector<HTMLElement>("#innehall h1") ?? document.getElementById("innehall");
      if (target) {
        target.setAttribute("tabindex", "-1");
        target.focus();
      }
    }
    focusContentAfterNav.current = false;
  }, [pathname, activeThemeId]);

  // Det aktiva kapitlet ska synas i spalten även på låg skärmhöjd.
  useEffect(() => {
    const box = asideRef.current;
    const el = box?.querySelector<HTMLElement>("[aria-current='page']");
    if (!box || !el || box.scrollHeight <= box.clientHeight) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < b.top || r.bottom > b.bottom) box.scrollTop += r.top - b.top - b.height / 3;
  }, [pathname]);

  // Panelen finns bara på små skärmar.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        openerRef.current?.focus();
      } else if (e.key === "Tab" && asideRef.current) {
        // Fokus stannar i panelen så länge den är öppen.
        const items = Array.from(asideRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")).filter((el) => el.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const navigated = () => {
    if (open) focusContentAfterNav.current = true;
  };
  const closeToOpener = () => {
    setOpen(false);
    openerRef.current?.focus();
  };

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
            {activeTheme ? `Tema ${activeTheme.order}: ${activeTheme.title}` : "Välj tema"}
          </span>
        </button>
      </div>

      {open && <button type="button" tabIndex={-1} aria-label="Stäng panelen" className="fixed inset-0 z-[60] bg-ink/40 lg:hidden" onClick={closeToOpener} />}

      <aside
        ref={asideRef}
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
            <button ref={closeRef} type="button" className="btn btn-small lg:hidden" onClick={closeToOpener}>
              Stäng
            </button>
          )}
        </div>
        <ol className="space-y-0.5">
          {themes.map((t) => {
            const isActive = onThemePage && t.id === activeThemeId; // aria-current="page" finns på exakt en post
            const holdsActive = !!activeChapter && t.id === activeThemeId;
            const isOpen = expanded.has(t.id);
            const listId = `nav-ch-${t.id}`;
            return (
              <li key={t.id}>
                <div className={`flex items-stretch rounded-lg ${isActive ? "bg-indigo-soft" : holdsActive ? "bg-paper-2" : ""}`}>
                  <Link
                    href={t.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={navigated}
                    className={`flex-1 rounded-lg px-2 py-2 text-[0.95rem] leading-snug no-underline ${isActive || holdsActive ? "font-bold text-indigo-dark" : "text-ink hover:bg-paper-2"}`}
                    data-testid={`nav-theme-${t.id}`}
                    data-contains-active={holdsActive ? "true" : undefined}
                  >
                    <span className="mr-1.5 tabular-nums text-ink-soft">{t.order}.</span>
                    {t.title}
                    {holdsActive && <span className="sr-only"> (innehåller kapitlet du läser)</span>}
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
                    const current = activeChapter?.c.id === c.id;
                    return (
                      <li key={c.id} className="text-sm leading-snug">
                        {c.published ? (
                          <Link
                            href={c.href}
                            onClick={navigated}
                            aria-current={current ? "page" : undefined}
                            className={`flex items-baseline gap-1.5 rounded-md border-l-4 px-2 py-1.5 no-underline ${current ? "border-indigo bg-indigo-soft font-bold text-indigo-dark" : "border-transparent hover:bg-paper-2"}`}
                            data-testid={`nav-chapter-${c.id}`}
                          >
                            <span>{c.title}</span>
                            {done && (
                              <span className="text-ok" data-testid={`nav-done-${c.id}`}>
                                <span aria-hidden="true">✓</span>
                                <span className="sr-only"> Slutfört</span>
                              </span>
                            )}
                          </Link>
                        ) : (
                          <span
                            className={`flex flex-wrap items-baseline gap-x-1.5 border-l-4 px-2 py-1.5 text-ink-soft ${current ? "border-indigo bg-indigo-soft" : "border-transparent"}`}
                            aria-current={current ? "page" : undefined}
                            data-testid={`nav-planned-${c.id}`}
                          >
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
