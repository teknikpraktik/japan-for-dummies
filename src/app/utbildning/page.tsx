import type { Metadata } from "next";
import Link from "next/link";
import { getContent } from "@/lib/content";
import { chapterPath } from "@/lib/chapters";
import { StatusBadge } from "@/components/ChapterClient";
import { CardThumb } from "@/components/Photo";
import { OverviewStats } from "@/components/OverviewStats";

export const metadata: Metadata = { title: "Utbildningsöversikt" };

export default function Overview() {
  const { themes, chapters } = getContent();
  const published = chapters.filter((c) => c.status === "published").length;
  return (
    <div className="container-page space-y-8 pt-8">
      <header className="space-y-2">
        <h1>Utbildningsöversikt</h1>
        <p className="prose-col">
          {themes.length} teman och {chapters.length} planerade kapitel. I pilotversionen är <strong>{published} kapitel färdiga</strong>. Övriga är planerade och markerade ”Kommer senare”. De saknar innehåll tills de skrivits och faktagranskats.
        </p>
        <OverviewStats chapters={chapters.map((c) => ({ id: c.id, themeId: c.themeId, status: c.status }))} />
      </header>

      <nav aria-label="Teman" className="card">
        <p className="mb-2 font-semibold">Hoppa till tema</p>
        <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {themes.map((t) => (
            <li key={t.id}>
              <a href={`#tema-${t.id}`}>
                {t.order}. {t.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {themes.map((t) => (
        <section key={t.id} id={`tema-${t.id}`} aria-labelledby={`h-${t.id}`} className="space-y-3 scroll-mt-4">
          <header>
            <p className="text-sm font-bold uppercase tracking-wide text-ink-soft">Tema {t.order} av {themes.length}</p>
            <h2 id={`h-${t.id}`}>{t.title}</h2>
            <p className="prose-col text-ink-soft">{t.description}</p>
          </header>
          <ol className="space-y-3">
            {chapters
              .filter((c) => c.themeId === t.id)
              .map((c) =>
                c.status === "published" ? (
                  <li key={c.id} className="card flex flex-col gap-2 border-indigo/40">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge badge-new">Färdigt</span>
                      <StatusBadge chapterId={c.id} />
                      <span className="text-sm text-ink-soft">Kapitel {c.order} · ca {c.minutes} min</span>
                    </div>
                    <CardThumb imageId={c.hero.imageId} />
                    <h3>
                      <Link href={chapterPath(c)}>{c.title}</Link>
                    </h3>
                    <p>{c.summary}</p>
                  </li>
                ) : (
                  <li key={c.id} className="card !bg-paper-2 flex flex-col gap-2 border-dashed">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge badge-planned">Kommer senare</span>
                      <span className="text-sm text-ink-soft">Kapitel {c.order}</span>
                    </div>
                    <h3 className="text-ink">
                      <Link href={chapterPath(c)}>{c.title}</Link>
                    </h3>
                    <p>{c.summary}</p>
                    <details>
                      <summary className="cursor-pointer font-semibold">Planerade lärandemål</summary>
                      <ul className="mt-2 list-disc space-y-1 pl-6">
                        {c.objectives.map((o) => (
                          <li key={o}>{o}</li>
                        ))}
                      </ul>
                    </details>
                  </li>
                ),
              )}
          </ol>
        </section>
      ))}
    </div>
  );
}
