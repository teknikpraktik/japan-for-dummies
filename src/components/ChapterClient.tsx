"use client";

import { useEffect } from "react";
import { progressStore, useProgress } from "@/lib/store";
import { chapterStatus } from "@/lib/progress";
import { writeLastChapter } from "@/lib/last-theme";

/** Markerar kapitlet som påbörjat när det öppnas. */
export function MarkStarted({ chapterId, contentVersion }: { chapterId: string; contentVersion: number }) {
  const { hydrated } = useProgress();
  useEffect(() => {
    if (!hydrated) return;
    progressStore.markStarted(chapterId, contentVersion);
    writeLastChapter(chapterId);
  }, [hydrated, chapterId, contentVersion]);
  return null;
}

/** Status för ett kapitel. Orörda kapitel visar ingen etikett; färgen är aldrig ensam signal (symbol och text följer med). */
export function StatusBadge({ chapterId, showUntouched = false }: { chapterId: string; showUntouched?: boolean }) {
  const { hydrated, state } = useProgress();
  if (!hydrated) return null;
  const st = chapterStatus(state, chapterId);
  if (st === "completed") return <span className="badge badge-ok" data-testid="status-completed"><span aria-hidden="true">✓</span> Slutfört</span>;
  if (st === "in-progress") return <span className="badge badge-progress" data-testid="status-started"><span aria-hidden="true">◐</span> Påbörjat</span>;
  return showUntouched ? <span className="badge badge-planned">Ej påbörjat</span> : null;
}
