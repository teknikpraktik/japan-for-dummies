import Link from "next/link";
import type { Chapter } from "@/lib/schema";
import { chapterPath } from "@/lib/chapters";
import { StatusBadge } from "./ChapterClient";
import { ChapterThumb } from "./Photo";

/** Kompakt horisontellt kapitelkort: liten bild till vänster, information till höger. */
export function ChapterCard({ chapter: c }: { chapter: Chapter }) {
  const published = c.status === "published";
  const imageId = published ? c.hero.imageId : null;
  const inner = (
    <>
      <ChapterThumb imageId={imageId} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
          <span>Kapitel {c.order}</span>
          {published ? <StatusBadge chapterId={c.id} /> : <span className="badge badge-planned">Kommer senare</span>}
        </div>
        <h3 className="text-base leading-snug sm:text-lg">
          {published ? (
            <Link href={chapterPath(c)} className="no-underline after:absolute after:inset-0 after:content-['']" style={{ color: "var(--color-indigo-dark)" }}>
              {c.title}
            </Link>
          ) : (
            <span className="text-ink">{c.title}</span>
          )}
        </h3>
        <p className="line-clamp-3 text-sm text-ink-soft sm:line-clamp-2">{c.summary}</p>
        {!published && (
          <details className="relative text-sm">
            <summary className="cursor-pointer font-semibold">Planerade lärandemål</summary>
            <ul className="mt-1 list-disc space-y-1 pl-6">
              {c.objectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </>
  );
  return (
    <li
      className={`tile flex gap-3 sm:gap-4 ${published ? "tile-link" : "tile-upcoming"}`}
      data-testid={`chapter-card-${c.id}`}
    >
      {inner}
    </li>
  );
}
