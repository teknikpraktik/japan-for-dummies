"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isCompleted, type ChapterRef } from "@/lib/progress";
import { readLastChapter, readLastTheme } from "@/lib/last-theme";
import { chapterPath, themePath } from "@/lib/chapters";
import { useProgress } from "@/lib/store";
import { ACCOUNTS_ENABLED } from "@/lib/features";
import { useAccount } from "./AccountProvider";

export interface ChapterLite extends ChapterRef {
  slug: string;
  title: string;
  minutes?: number;
}

interface Target {
  href: string;
  label: string;
  /** Kapitlet knappen leder till, om det finns ett påbörjat. */
  chapterTitle?: string;
}

/**
 * Väljer mål för huvudknappen ur befintlig lokal information:
 *  1. senast öppnade kapitel, om det är påbörjat men inte slutfört,
 *  2. annars det senast påbörjade av de ofullständiga kapitlen,
 *  3. annars senast valda tema, och som sista reserv tema 1.
 */
export function pickTarget(
  state: { chapters: Record<string, { startedAt?: string; completedAt?: string }> },
  chapters: ChapterLite[],
  lastChapterId: string | null,
  lastThemeId: string | null,
  firstThemeId: string,
): Target {
  const published = chapters.filter((c) => c.status === "published");
  const unfinished = published.filter((c) => state.chapters[c.id] && !isCompleted(state as Parameters<typeof isCompleted>[0], c.id));
  const last = lastChapterId ? unfinished.find((c) => c.id === lastChapterId) : undefined;
  const latest = [...unfinished].sort((a, b) => (state.chapters[b.id]?.startedAt ?? "").localeCompare(state.chapters[a.id]?.startedAt ?? ""))[0];
  const chosen = last ?? latest;
  if (chosen) return { href: chapterPath(chosen), label: "Fortsätt utbildningen", chapterTitle: chosen.title };
  const hasHistory = Object.keys(state.chapters).length > 0 || Boolean(lastThemeId);
  return { href: themePath(lastThemeId ?? firstThemeId), label: hasHistory ? "Fortsätt utbildningen" : "Börja utbildningen" };
}

/** Startsidans huvudknapp. Visas först när lokal lagring lästs, så att texten inte byter under laddning. */
export function StartCta({ chapters, firstThemeId }: { chapters: ChapterLite[]; firstThemeId: string }) {
  const { hydrated, state } = useProgress();
  const { user, unverified } = useAccount();
  const [saved, setSaved] = useState<{ chapter: string | null; theme: string | null } | null>(null);

  useEffect(() => {
    const ids = chapters.map((c) => c.id);
    const themeIds = Array.from(new Set(chapters.map((c) => c.themeId)));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- läser lokal lagring en gång efter laddning
    setSaved({ chapter: readLastChapter(ids), theme: readLastTheme(themeIds) });
  }, [chapters]);

  const ready = hydrated && saved !== null;
  const target = ready ? pickTarget(state, chapters, saved.chapter, saved.theme, firstThemeId) : null;
  const student = user?.role === "student" && !unverified;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {target ? (
        <Link className="btn btn-primary" href={target.href} data-testid="start-cta">
          {target.label}
        </Link>
      ) : (
        // Samma storlek som den riktiga knappen, men osynlig tills vi vet vilken text som gäller.
        <>
          <span className="btn btn-primary invisible" aria-hidden="true">
            Fortsätt utbildningen
          </span>
          <noscript>
            <Link className="btn btn-primary" href={themePath(firstThemeId)}>
              Börja utbildningen
            </Link>
          </noscript>
        </>
      )}
      {target?.chapterTitle && (
        <span className="text-sm text-ink-soft" data-testid="start-cta-chapter">
          Fortsätt med: {target.chapterTitle}
        </span>
      )}
      {ACCOUNTS_ENABLED &&
        (user ? (
          <Link className="btn" href={user.role === "teacher" ? "/lararen/" : "/min-utbildning/"}>
            {student ? "Min utbildning" : "Till lärarsidan"}
          </Link>
        ) : (
          <Link className="btn" href="/logga-in/">
            Logga in
          </Link>
        ))}
    </div>
  );
}
