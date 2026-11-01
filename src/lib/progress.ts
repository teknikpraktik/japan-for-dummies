import { z } from "zod";
import { isPassed } from "./scoring";

export const STATE_VERSION = 1;
export const MAX_CHAPTERS_IN_STATE = 200;

export interface Attempt {
  score: number;
  at: string;
}
export interface ChapterProgress {
  startedAt: string;
  completedAt?: string;
  best?: Attempt;
  last?: Attempt;
  contentVersion: number;
}
export interface QuizDraft {
  /** 0 = ursprunglig ordning, annars blandad ordning för omförsök. */
  seed: number;
  signature: string;
  answers: Record<string, string>;
  finished: boolean;
}
export interface ProgressState {
  version: number;
  chapters: Record<string, ChapterProgress>;
  favorites: string[];
  lastExportAt?: string;
  drafts: Record<string, QuizDraft>;
}

export function emptyState(): ProgressState {
  return { version: STATE_VERSION, chapters: {}, favorites: [], drafts: {} };
}

/* ---------- Validering ---------- */
const idRe = /^[a-z0-9][a-z0-9-]{0,63}$/;
const isoStr = z.string().max(40).refine((s) => !Number.isNaN(Date.parse(s)), "Ogiltigt datum");
const attempt = z.object({ score: z.number().int().min(0).max(5), at: isoStr });
const chapterProgress = z.object({
  startedAt: isoStr,
  completedAt: isoStr.optional(),
  best: attempt.optional(),
  last: attempt.optional(),
  contentVersion: z.number().int().min(0).max(10000),
});
export const transferDataSchema = z.object({
  chapters: z.record(z.string().regex(idRe), chapterProgress).refine((r) => Object.keys(r).length <= MAX_CHAPTERS_IN_STATE, "För många kapitel"),
  favorites: z.array(z.string().regex(idRe)).max(MAX_CHAPTERS_IN_STATE),
});

const storedSchema = z.object({
  version: z.literal(STATE_VERSION),
  chapters: transferDataSchema.shape.chapters,
  favorites: transferDataSchema.shape.favorites,
  lastExportAt: isoStr.optional(),
  drafts: z
    .record(
      z.string().regex(idRe),
      z.object({
        seed: z.number().int().min(0).max(2 ** 31),
        signature: z.string().max(2000),
        answers: z.record(z.string().max(64), z.string().max(64)),
        finished: z.boolean(),
      }),
    )
    .default({}),
});

/** Tolkar lagrad text. Returnerar null om innehållet är skadat eller har okänd version. */
export function parseStoredState(raw: string | null): ProgressState | null | "empty" {
  if (raw === null) return "empty";
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    return { ...parsed.data, favorites: [...new Set(parsed.data.favorites)] };
  } catch {
    return null;
  }
}

/* ---------- Rena tillståndsfunktioner ---------- */
const iso = (d: Date) => d.toISOString();

export function markStarted(s: ProgressState, chapterId: string, contentVersion: number, now = new Date()): ProgressState {
  if (s.chapters[chapterId]) return s;
  return { ...s, chapters: { ...s.chapters, [chapterId]: { startedAt: iso(now), contentVersion } } };
}

export function recordQuizResult(s: ProgressState, chapterId: string, contentVersion: number, score: number, now = new Date()): ProgressState {
  const prev = s.chapters[chapterId] ?? { startedAt: iso(now), contentVersion };
  const at = iso(now);
  const best = !prev.best || score > prev.best.score ? { score, at } : prev.best;
  const completedAt = prev.completedAt ?? (isPassed(score) ? at : undefined);
  const next: ChapterProgress = { ...prev, contentVersion, best, last: { score, at }, ...(completedAt ? { completedAt } : {}) };
  return { ...s, chapters: { ...s.chapters, [chapterId]: next } };
}

export function toggleFavorite(s: ProgressState, chapterId: string): ProgressState {
  const has = s.favorites.includes(chapterId);
  return { ...s, favorites: has ? s.favorites.filter((f) => f !== chapterId) : [...s.favorites, chapterId] };
}

export function setDraft(s: ProgressState, chapterId: string, draft: QuizDraft): ProgressState {
  return { ...s, drafts: { ...s.drafts, [chapterId]: draft } };
}
export function clearDraft(s: ProgressState, chapterId: string): ProgressState {
  if (!s.drafts[chapterId]) return s;
  const drafts = { ...s.drafts };
  delete drafts[chapterId];
  return { ...s, drafts };
}

export function isCompleted(s: ProgressState, chapterId: string): boolean {
  return Boolean(s.chapters[chapterId]?.completedAt);
}

export type ChapterStatus = "not-started" | "in-progress" | "completed";
export function chapterStatus(s: ProgressState, chapterId: string): ChapterStatus {
  const c = s.chapters[chapterId];
  if (!c) return "not-started";
  return c.completedAt ? "completed" : "in-progress";
}

export interface ChapterRef {
  id: string;
  themeId: string;
  status: "published" | "planned";
}

/** Nästa föreslagna kapitel: första publicerade i ordning som inte är avklarat. Pågående går före orörda. */
export function suggestNext(s: ProgressState, ordered: ChapterRef[]): ChapterRef | undefined {
  const open = ordered.filter((c) => c.status === "published" && !isCompleted(s, c.id));
  return open.find((c) => chapterStatus(s, c.id) === "in-progress") ?? open[0];
}

export interface ThemeProgress {
  themeId: string;
  published: number;
  planned: number;
  completed: number;
  started: number;
}
export function themeProgress(s: ProgressState, ordered: ChapterRef[]): ThemeProgress[] {
  const map = new Map<string, ThemeProgress>();
  for (const c of ordered) {
    const t = map.get(c.themeId) ?? { themeId: c.themeId, published: 0, planned: 0, completed: 0, started: 0 };
    if (c.status === "published") {
      t.published++;
      if (isCompleted(s, c.id)) t.completed++;
      else if (s.chapters[c.id]) t.started++;
    } else t.planned++;
    map.set(c.themeId, t);
  }
  return [...map.values()];
}

/** Antal kapitel som blivit avklarade efter senaste export (eller totalt om aldrig exporterat). */
export function completedSinceExport(s: ProgressState): number {
  const since = s.lastExportAt ? Date.parse(s.lastExportAt) : 0;
  return Object.values(s.chapters).filter((c) => c.completedAt && Date.parse(c.completedAt) > since).length;
}

/* ---------- Sammanslagning ---------- */
export function mergeChapter(a: ChapterProgress, b: ChapterProgress): ChapterProgress {
  const earlier = (x?: string, y?: string) => (x && y ? (Date.parse(x) <= Date.parse(y) ? x : y) : (x ?? y));
  const best = a.best && b.best ? (b.best.score > a.best.score ? b.best : a.best) : (a.best ?? b.best);
  const last = a.last && b.last ? (Date.parse(b.last.at) > Date.parse(a.last.at) ? b.last : a.last) : (a.last ?? b.last);
  const completedAt = earlier(a.completedAt, b.completedAt);
  return {
    startedAt: earlier(a.startedAt, b.startedAt)!,
    contentVersion: Math.max(a.contentVersion, b.contentVersion),
    ...(best ? { best } : {}),
    ...(last ? { last } : {}),
    ...(completedAt ? { completedAt } : {}),
  };
}

export function mergeStates(current: ProgressState, incoming: Pick<ProgressState, "chapters" | "favorites">): ProgressState {
  const chapters: Record<string, ChapterProgress> = { ...current.chapters };
  for (const [id, c] of Object.entries(incoming.chapters)) chapters[id] = chapters[id] ? mergeChapter(chapters[id], c) : c;
  const favorites = [...new Set([...current.favorites, ...incoming.favorites])];
  return { ...current, chapters, favorites };
}

export function replaceState(current: ProgressState, incoming: Pick<ProgressState, "chapters" | "favorites">): ProgressState {
  return { ...current, chapters: incoming.chapters, favorites: [...new Set(incoming.favorites)], drafts: {} };
}

/* ---------- Central status (konto) ---------- */
export interface ServerProgressRow {
  chapterId: string;
  status: "started" | "completed";
  completedAt: string | null;
  chapterVersion: number;
  completedVersion: number | null;
}

/**
 * Slår ihop serverns status in i lokala framsteg. Avklarat återgår aldrig till påbörjat. Lokala resultat
 * (bästa/senaste poäng) rörs inte; de finns bara på enheten och kan saknas när man loggar in på en ny enhet.
 */
export function mergeServerRows(s: ProgressState, rows: ServerProgressRow[], now = new Date()): ProgressState {
  let next = s;
  for (const r of rows) {
    const cur = next.chapters[r.chapterId];
    if (!cur) next = { ...next, chapters: { ...next.chapters, [r.chapterId]: { startedAt: iso(now), contentVersion: r.chapterVersion } } };
    if (r.status === "completed" && r.completedAt) {
      const c = next.chapters[r.chapterId];
      const completedAt = c.completedAt && Date.parse(c.completedAt) <= Date.parse(r.completedAt) ? c.completedAt : r.completedAt;
      next = { ...next, chapters: { ...next.chapters, [r.chapterId]: { ...c, completedAt, contentVersion: Math.max(c.contentVersion, r.completedVersion ?? r.chapterVersion) } } };
    }
  }
  return next;
}
