"use client";

import Link from "next/link";
import { chapterStatus, suggestNext, type ChapterRef } from "@/lib/progress";
import { useProgress } from "@/lib/store";
import { useAccount } from "./AccountProvider";

export interface ChapterLite extends ChapterRef {
  slug: string;
  title: string;
  minutes?: number;
}

/** Startsidans knappar: ”Börja utbildningen” för nya besökare, ”Fortsätt” för den som redan börjat. */
export function StartCta({ chapters }: { chapters: ChapterLite[] }) {
  const { hydrated, state } = useProgress();
  const { user, unverified } = useAccount();
  const next = hydrated ? (suggestNext(state, chapters) as ChapterLite | undefined) : undefined;
  const started = hydrated && Object.keys(state.chapters).length > 0 && next;
  const student = user?.role === "student" && !unverified;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {started && next ? (
        <Link className="btn btn-primary" href={`/kapitel/${next.slug}/`}>
          {chapterStatus(state, next.id) === "in-progress" ? "Fortsätt" : "Nästa kapitel"}: {next.title}
        </Link>
      ) : (
        <Link className="btn btn-primary" href="/utbildning/">
          Börja utbildningen
        </Link>
      )}
      {started && next && (
        <Link className="btn" href="/utbildning/">
          Alla teman
        </Link>
      )}
      {user ? (
        <Link className="btn" href={user.role === "teacher" ? "/lararen/" : "/min-utbildning/"}>
          {student ? "Min utbildning" : "Till lärarsidan"}
        </Link>
      ) : (
        <Link className="btn" href="/logga-in/">
          Logga in
        </Link>
      )}
    </div>
  );
}
