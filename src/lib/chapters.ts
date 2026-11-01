import type { Chapter, Theme } from "./schema";

export function chapterPath(c: Pick<Chapter, "slug">): string {
  return `/kapitel/${c.slug}/`;
}

export function themeOf(themes: Theme[], c: Chapter): Theme {
  return themes.find((t) => t.id === c.themeId)!;
}

export function positionOf(chapters: Chapter[], c: Chapter) {
  const index = chapters.findIndex((x) => x.id === c.id);
  return {
    overall: index + 1,
    total: chapters.length,
    prev: index > 0 ? chapters[index - 1] : undefined,
    next: index < chapters.length - 1 ? chapters[index + 1] : undefined,
  };
}

export function themePath(themeId: string): string {
  return `/utbildning/${themeId}/`;
}
