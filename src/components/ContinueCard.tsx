"use client";

import Link from "next/link";
import { chapterStatus, suggestNext, type ChapterRef } from "@/lib/progress";
import { useProgress } from "@/lib/store";

export interface ChapterLite extends ChapterRef {
  slug: string;
  title: string;
  minutes?: number;
}

export function ContinueCard({ chapters }: { chapters: ChapterLite[] }) {
  const { hydrated, state } = useProgress();
  const next = hydrated ? (suggestNext(state, chapters) as ChapterLite | undefined) : undefined;
  const hasProgress = hydrated && Object.keys(state.chapters).length > 0;
  const allDone = hydrated && hasProgress && !next;

  return (
    <section aria-labelledby="fortsatt" className="card flex flex-col gap-3">
      <h2 id="fortsatt">Fortsätt lära</h2>
      {!hydrated ? (
        <p aria-busy="true" className="text-ink-soft">Hämtar dina framsteg…</p>
      ) : allDone ? (
        <p>Du har klarat alla färdiga kapitel i piloten. Fler kapitel kommer senare. Under tiden kan du repetera eller exportera dina framsteg.</p>
      ) : next ? (
        <>
          <p>
            {chapterStatus(state, next.id) === "in-progress" ? "Du är mitt i:" : "Nästa föreslagna kapitel:"} <strong>{next.title}</strong>
            {next.minutes ? <> (ca {next.minutes} min)</> : null}
          </p>
          <Link className="btn btn-primary self-start" href={`/kapitel/${next.slug}/`}>
            {chapterStatus(state, next.id) === "in-progress" ? "Fortsätt kapitlet" : "Gå till kapitlet"}
          </Link>
        </>
      ) : (
        <p>Du har inte börjat än. Börja med ”Börja här” så föreslår vi nästa kapitel efteråt.</p>
      )}
      <Link href="/resepass/" className="self-start">Öppna ditt resepass</Link>
    </section>
  );
}
