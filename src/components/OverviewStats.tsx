"use client";

import { themeProgress, type ChapterRef } from "@/lib/progress";
import { useProgress } from "@/lib/store";

export function OverviewStats({ chapters }: { chapters: ChapterRef[] }) {
  const { hydrated, state } = useProgress();
  if (!hydrated) return null;
  const totals = themeProgress(state, chapters).reduce((a, t) => ({ published: a.published + t.published, completed: a.completed + t.completed }), { published: 0, completed: 0 });
  return (
    <p className="font-semibold" data-testid="overview-stats">
      Du har klarat {totals.completed} av {totals.published} färdiga kapitel.
    </p>
  );
}
