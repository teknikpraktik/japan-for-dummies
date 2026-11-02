import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getContent } from "@/lib/content";
import { chapterPath, positionOf, themeOf, themePath } from "@/lib/chapters";
import type { PublishedChapter } from "@/lib/schema";
import { Blocks } from "@/components/Blocks";
import { ExerciseRenderer } from "@/components/exercises/ExerciseRenderer";
import { Quiz } from "@/components/Quiz";
import { PhotoRights, PhotoSlot, photosFor } from "@/components/Photo";
import { MarkStarted, StatusBadge } from "@/components/ChapterClient";

export function generateStaticParams() {
  return getContent().chapters.map((c) => ({ slug: c.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = getContent().chapters.find((x) => x.slug === slug);
  return c ? { title: c.title, description: c.summary } : {};
}

export default async function ChapterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { chapters, themes, sources, media } = getContent();
  const chapter = chapters.find((c) => c.slug === slug);
  if (!chapter) notFound();
  const theme = themeOf(themes, chapter);
  const pos = positionOf(chapters, chapter);
  const nextPublished = chapters.slice(pos.overall).find((c) => c.status === "published");

  const header = (
    <header className="space-y-3">
      <nav aria-label="Brödsmula" className="flex flex-wrap items-center gap-x-2 text-sm">
        <Link href={themePath(chapter.themeId)} className="btn btn-small">
          <span aria-hidden="true">←</span> Till översikten
        </Link>
        <span className="text-ink-soft">
          {theme.title}
        </span>
      </nav>
      <h1>{chapter.title}</h1>
      <p className="prose-col text-lg">{chapter.summary}</p>
    </header>
  );

  if (chapter.status === "planned") {
    return (
      <article className="min-w-0 space-y-6">
        {header}
        <div className="card !bg-paper-2 space-y-3 prose-col">
          <p>
            <span className="badge badge-planned">Kommer senare</span>
          </p>
          <p>Det här kapitlet är planerat men inte skrivet än. Det finns inget innehåll, ingen övning och inget test. Här är vad kapitlet är tänkt att handla om.</p>
          <h2 className="!text-xl">Planerade lärandemål</h2>
          <ul className="list-disc space-y-1 pl-6">
            {chapter.objectives.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </div>
        <ChapterNav prev={pos.prev} next={pos.next} />
      </article>
    );
  }

  const ch: PublishedChapter = chapter;
  const usedSources = ch.sourceIds.map((id) => sources.find((s) => s.id === id)!);
  const usedMedia = ch.mediaIds.map((id) => media.find((m) => m.id === id)!);
  const chapterPhotos = photosFor([ch.hero.imageId, ...ch.sections.flatMap((x) => x.blocks).map((b) => (b.type === "photo" ? b.imageId : null))]);
  const nextHref = nextPublished ? { href: chapterPath(nextPublished), label: `Nästa färdiga kapitel: ${nextPublished.title}` } : undefined;

  return (
    <article className="min-w-0 space-y-10">
      <MarkStarted chapterId={ch.id} contentVersion={ch.contentVersion} />
      {header}
      <PhotoSlot role="hero" priority slotId={ch.hero.slotId} imageId={ch.hero.imageId} brief={ch.hero.brief} />
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge chapterId={ch.id} />
        <span className="text-sm text-ink-soft">Cirka {ch.minutes} minuter inklusive test</span>
      </div>

      <section aria-labelledby="inledning" className="card !bg-indigo-soft prose-col space-y-2">
        <h2 id="inledning" className="!text-lg">{ch.hook.kind === "question" ? "Att fundera på" : "Tänk dig situationen"}</h2>
        <p className="text-lg">{ch.hook.text}</p>
      </section>

      <section aria-labelledby="mal" className="prose-col space-y-2">
        <h2 id="mal">Efter kapitlet kan du</h2>
        <ul className="list-disc space-y-1 pl-6">
          {ch.objectives.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </section>

      {ch.sections.map((s) => (
        <section key={s.id} aria-labelledby={`s-${s.id}`} className="prose-col space-y-3">
          <h2 id={`s-${s.id}`}>{s.heading}</h2>
          <Blocks blocks={s.blocks} media={media} />
        </section>
      ))}

      <section aria-labelledby="ovningar" className="space-y-4">
        <h2 id="ovningar">Öva</h2>
        {ch.exercises.map((e) => (
          <ExerciseRenderer key={e.id} exercise={e} />
        ))}
      </section>

      <section aria-labelledby="markare" className="card prose-col space-y-2">
        <h2 id="markare">Lägg märke till på resan</h2>
        <ul className="list-disc space-y-1 pl-6">
          {ch.noticeOnTrip.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="reflektion" className="card prose-col space-y-2">
        <h2 id="reflektion">Reflektera</h2>
        <p>{ch.reflection}</p>
      </section>

      <Quiz chapterId={ch.id} contentVersion={ch.contentVersion} questions={ch.quiz} nextHref={nextHref} overviewHref={themePath(ch.themeId)} />

      <section className="space-y-4 prose-col">
        <h2>Källor</h2>
        {usedSources.length === 0 ? (
          <p>Kapitlet bygger på allmän kunskap och har inga externa källor.</p>
        ) : (
          <ul className="space-y-2">
            {usedSources.map((s) => (
              <li key={s.id}>
                <a href={s.url} rel="noopener noreferrer" target="_blank">
                  {s.title}
                </a>{" "}
                – {s.publisher}. <span className="text-ink-soft">{s.supports}</span>
              </li>
            ))}
          </ul>
        )}
        <p>
          <Link href="/kallor/">Se alla källor i projektet</Link>
        </p>
      </section>

      <PhotoRights photos={chapterPhotos} media={usedMedia} />

      <ChapterNav prev={pos.prev} next={pos.next} />
    </article>
  );
}

function ChapterNav({ prev, next }: { prev?: { slug: string; title: string; status: string }; next?: { slug: string; title: string; status: string } }) {
  return (
    <nav aria-label="Kapitelnavigering" className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:justify-between">
      {prev ? (
        <Link className="btn" href={chapterPath(prev)}>
          <span aria-hidden="true">←</span> {prev.title}
          {prev.status === "planned" && " (kommer senare)"}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link className="btn" href={chapterPath(next)}>
          {next.title}
          {next.status === "planned" && " (kommer senare)"} <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
