"use client";

import { useEffect } from "react";
import { progressStore, useProgress } from "@/lib/store";
import { chapterStatus } from "@/lib/progress";

/** Markerar kapitlet som påbörjat när det öppnas. */
export function MarkStarted({ chapterId, contentVersion }: { chapterId: string; contentVersion: number }) {
  const { hydrated } = useProgress();
  useEffect(() => {
    if (hydrated) progressStore.markStarted(chapterId, contentVersion);
  }, [hydrated, chapterId, contentVersion]);
  return null;
}

export function FavoriteButton({ chapterId, title }: { chapterId: string; title: string }) {
  const { hydrated, state } = useProgress();
  const fav = state.favorites.includes(chapterId);
  return (
    <button
      className="btn btn-small"
      aria-pressed={hydrated ? fav : false}
      onClick={() => progressStore.toggleFavorite(chapterId)}
      disabled={!hydrated}
      aria-label={`${fav ? "Ta bort favorit" : "Favoritmarkera"}: ${title}`}
    >
      <span aria-hidden="true">{fav ? "★" : "☆"}</span> {fav ? "Favorit" : "Favoritmarkera"}
    </button>
  );
}

export function StatusBadge({ chapterId }: { chapterId: string }) {
  const { hydrated, state } = useProgress();
  if (!hydrated) return null;
  const st = chapterStatus(state, chapterId);
  const best = state.chapters[chapterId]?.best;
  if (st === "completed") return <span className="badge badge-ok">✓ Klar{best ? ` (${best.score}/5)` : ""}</span>;
  if (st === "in-progress") return <span className="badge badge-progress">Påbörjad{best ? ` (bäst ${best.score}/5)` : ""}</span>;
  return <span className="badge badge-planned">Ej påbörjad</span>;
}
