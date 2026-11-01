import { describe, expect, it } from "vitest";
import {
  chapterStatus,
  completedSinceExport,
  emptyState,
  markStarted,
  mergeStates,
  parseStoredState,
  recordQuizResult,
  replaceState,
  suggestNext,
  themeProgress,
  toggleFavorite,
  type ChapterRef,
} from "@/lib/progress";

const t = (m: number) => new Date(Date.UTC(2026, 10, m, 12));
const chapters: ChapterRef[] = [
  { id: "a", themeId: "x", status: "published" },
  { id: "b", themeId: "x", status: "published" },
  { id: "c", themeId: "x", status: "planned" },
  { id: "d", themeId: "y", status: "published" },
];

describe("framsteg", () => {
  it("fyra rätt ger Klar, tre rätt gör det inte", () => {
    let s = recordQuizResult(emptyState(), "a", 1, 3, t(1));
    expect(chapterStatus(s, "a")).toBe("in-progress");
    s = recordQuizResult(s, "a", 1, 4, t(2));
    expect(chapterStatus(s, "a")).toBe("completed");
  });
  it("sparar bästa resultat och senaste försök separat, och förlorar aldrig Klar", () => {
    let s = recordQuizResult(emptyState(), "a", 1, 5, t(1));
    s = recordQuizResult(s, "a", 1, 2, t(2));
    expect(s.chapters.a.best?.score).toBe(5);
    expect(s.chapters.a.last?.score).toBe(2);
    expect(chapterStatus(s, "a")).toBe("completed");
  });
  it("markStarted ändrar inte befintliga framsteg", () => {
    const s = recordQuizResult(emptyState(), "a", 1, 4, t(1));
    expect(markStarted(s, "a", 1, t(5))).toBe(s);
    expect(markStarted(emptyState(), "a", 1, t(5)).chapters.a.startedAt).toContain("2026-11-05");
  });
  it("favoriter växlar", () => {
    let s = toggleFavorite(emptyState(), "a");
    expect(s.favorites).toEqual(["a"]);
    s = toggleFavorite(s, "a");
    expect(s.favorites).toEqual([]);
  });
  it("föreslår pågående kapitel före orörda, hoppar över klara och planerade", () => {
    expect(suggestNext(emptyState(), chapters)?.id).toBe("a");
    let s = recordQuizResult(emptyState(), "a", 1, 5, t(1));
    expect(suggestNext(s, chapters)?.id).toBe("b");
    s = markStarted(s, "d", 1, t(2));
    expect(suggestNext(s, chapters)?.id).toBe("d");
    s = recordQuizResult(recordQuizResult(s, "b", 1, 4, t(3)), "d", 1, 4, t(3));
    expect(suggestNext(s, chapters)).toBeUndefined();
  });
  it("framsteg per tema", () => {
    const s = recordQuizResult(markStarted(emptyState(), "b", 1, t(1)), "a", 1, 4, t(1));
    const x = themeProgress(s, chapters).find((p) => p.themeId === "x")!;
    expect(x).toMatchObject({ published: 2, planned: 1, completed: 1, started: 1 });
  });
  it("räknar klara kapitel sedan senaste export", () => {
    let s = recordQuizResult(emptyState(), "a", 1, 4, t(1));
    expect(completedSinceExport(s)).toBe(1);
    s = { ...s, lastExportAt: t(2).toISOString() };
    expect(completedSinceExport(s)).toBe(0);
    s = recordQuizResult(s, "b", 1, 5, t(3));
    expect(completedSinceExport(s)).toBe(1);
  });
});

describe("sammanslagning och ersättning", () => {
  it("behåller bästa resultat, tidigaste klar-datum och slår ihop favoriter", () => {
    const a = toggleFavorite(recordQuizResult(emptyState(), "a", 1, 4, t(3)), "a");
    const b = toggleFavorite(recordQuizResult(recordQuizResult(emptyState(), "a", 1, 5, t(1)), "b", 1, 2, t(5)), "b");
    const m = mergeStates(a, b);
    expect(m.chapters.a.best?.score).toBe(5);
    expect(m.chapters.a.completedAt).toContain("2026-11-01");
    expect(m.chapters.a.last?.at).toContain("2026-11-03");
    expect(m.chapters.b.best?.score).toBe(2);
    expect(m.favorites.sort()).toEqual(["a", "b"]);
  });
  it("ersätt tar bort tidigare framsteg", () => {
    const a = recordQuizResult(emptyState(), "a", 1, 5, t(1));
    const b = recordQuizResult(emptyState(), "b", 1, 4, t(2));
    const r = replaceState(a, b);
    expect(Object.keys(r.chapters)).toEqual(["b"]);
  });
});

describe("lagrad data", () => {
  it("tom lagring ger 'empty'", () => expect(parseStoredState(null)).toBe("empty"));
  it("skadad JSON ger null", () => expect(parseStoredState("{trasig")).toBeNull());
  it("fel version eller fel struktur ger null", () => {
    expect(parseStoredState(JSON.stringify({ version: 99, chapters: {}, favorites: [] }))).toBeNull();
    expect(parseStoredState(JSON.stringify({ version: 1, chapters: { a: { startedAt: "x" } }, favorites: [] }))).toBeNull();
  });
  it("giltig data läses tillbaka", () => {
    const s = recordQuizResult(emptyState(), "a", 1, 4, t(1));
    const back = parseStoredState(JSON.stringify(s));
    expect(back).toEqual(s);
  });
});
