import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getContent } from "@/lib/content";
import { PASS_MARK, scoreQuiz } from "@/lib/scoring";
import type { PublishedChapter } from "@/lib/schema";
import { getDb, schema } from "../db";
import { audit } from "./audit";

/** Publicerade kapitel. De 54 planerade kapitlen räknas aldrig som uppgifter. */
export function publishedChapters(): PublishedChapter[] {
  return getContent().chapters.filter((c): c is PublishedChapter => c.status === "published");
}
export function findPublished(chapterId: string): PublishedChapter | undefined {
  return publishedChapters().find((c) => c.id === chapterId);
}

const idRe = /^[a-z0-9][a-z0-9-]{0,63}$/;
const answersSchema = z.record(z.string().regex(/^[a-z0-9-]{1,32}$/), z.string().regex(/^[a-z0-9-]{1,32}$/)).refine((a) => Object.keys(a).length <= 10);

export const opSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("started"), chapterId: z.string().regex(idRe), contentVersion: z.number().int().min(0).max(10000) }).strict(),
  z.object({ type: z.literal("completed"), chapterId: z.string().regex(idRe), contentVersion: z.number().int().min(0).max(10000), answers: answersSchema }).strict(),
]);
export const syncBodySchema = z.object({ ops: z.array(opSchema).max(60) }).strict();
export type SyncOp = z.infer<typeof opSchema>;

export type OpResult = { chapterId: string; result: "ok" | "unknown-chapter" | "version-mismatch" | "not-passed" };

export interface ProgressRow {
  chapterId: string;
  status: "started" | "completed";
  source: "quiz" | "imported";
  chapterVersion: number;
  completedVersion: number | null;
  completedAt: string | null;
  /** True om kapitlet har uppdaterats efter att det blev avklarat. */
  outdated: boolean;
}

export async function getOwnProgress(userId: string): Promise<{ rows: ProgressRow[]; lastSyncedAt: string | null }> {
  const db = getDb();
  const rows = await db.select().from(schema.progress).where(eq(schema.progress.userId, userId));
  const sync = await db.select().from(schema.syncState).where(eq(schema.syncState.userId, userId)).limit(1);
  const versions = new Map(publishedChapters().map((c) => [c.id, c.contentVersion]));
  return {
    rows: rows
      .filter((r) => versions.has(r.chapterId))
      .map((r) => ({
        chapterId: r.chapterId,
        status: r.status as "started" | "completed",
        source: r.source as "quiz" | "imported",
        chapterVersion: r.chapterVersion,
        completedVersion: r.completedVersion,
        completedAt: r.completedAt?.toISOString() ?? null,
        outdated: r.status === "completed" && (r.completedVersion ?? 0) < (versions.get(r.chapterId) ?? 0),
      })),
    lastSyncedAt: sync[0]?.lastSyncedAt.toISOString() ?? null,
  };
}

/** Startad: skapar rad om den saknas. Rör aldrig en befintlig rad (avklarat kan inte bli påbörjat). */
async function upsertStarted(userId: string, chapterId: string, version: number) {
  await getDb().execute(sql`
    INSERT INTO progress (user_id, chapter_id, chapter_version, status, source, started_at, updated_at)
    VALUES (${userId}, ${chapterId}, ${version}, 'started', 'quiz', now(), now())
    ON CONFLICT (user_id, chapter_id) DO NOTHING`);
}

/**
 * Avklarat: monotont. completed_at behålls om det redan finns. En bekräftad (quiz) status ersätter en självrapporterad.
 * Samtidiga och upprepade anrop ger samma slutresultat (idempotent).
 */
async function upsertCompleted(userId: string, chapterId: string, version: number) {
  await getDb().execute(sql`
    INSERT INTO progress (user_id, chapter_id, chapter_version, status, source, started_at, completed_at, completed_version, updated_at)
    VALUES (${userId}, ${chapterId}, ${version}, 'completed', 'quiz', now(), now(), ${version}, now())
    ON CONFLICT (user_id, chapter_id) DO UPDATE SET
      status = 'completed',
      source = 'quiz',
      chapter_version = GREATEST(progress.chapter_version, EXCLUDED.chapter_version),
      completed_version = GREATEST(COALESCE(progress.completed_version, 0), EXCLUDED.completed_version),
      completed_at = COALESCE(progress.completed_at, EXCLUDED.completed_at),
      updated_at = now()`);
}

async function touchSync(userId: string) {
  await getDb().execute(sql`
    INSERT INTO sync_state (user_id, last_synced_at) VALUES (${userId}, now())
    ON CONFLICT (user_id) DO UPDATE SET last_synced_at = now()`);
}

/** Servern validerar kapitel, version och (för avklarat) provresultatet innan status ändras. Svaren sparas aldrig. */
export async function applyOps(userId: string, ops: SyncOp[]): Promise<OpResult[]> {
  const results: OpResult[] = [];
  for (const op of ops) {
    const chapter = findPublished(op.chapterId);
    if (!chapter) {
      results.push({ chapterId: op.chapterId, result: "unknown-chapter" });
      continue;
    }
    if (op.type === "started") {
      await upsertStarted(userId, chapter.id, chapter.contentVersion);
      results.push({ chapterId: chapter.id, result: "ok" });
      continue;
    }
    if (op.contentVersion !== chapter.contentVersion) {
      // Kapitlet har ändrats sedan eleven gjorde testet. Servern kan inte kontrollera svar mot den gamla versionen.
      await upsertStarted(userId, chapter.id, chapter.contentVersion);
      results.push({ chapterId: chapter.id, result: "version-mismatch" });
      continue;
    }
    const score = scoreQuiz(chapter.quiz, op.answers);
    if (score < PASS_MARK) {
      await upsertStarted(userId, chapter.id, chapter.contentVersion);
      results.push({ chapterId: chapter.id, result: "not-passed" });
      continue;
    }
    await upsertCompleted(userId, chapter.id, chapter.contentVersion);
    results.push({ chapterId: chapter.id, result: "ok" });
  }
  await touchSync(userId);
  return results;
}

/* ---------------------------------------------------------- Äldre lokala */

export const importSchema = z
  .object({
    confirm: z.literal(true),
    chapters: z
      .array(
        z.object({
          chapterId: z.string().regex(idRe),
          contentVersion: z.number().int().min(0).max(10000),
          completed: z.boolean(),
          completedAt: z.string().max(40).optional(),
        }),
      )
      .max(100),
  })
  .strict();

/** Självrapporterat. Ändrar aldrig en redan bekräftad status. Upprepning ger samma resultat. */
export async function importLegacy(userId: string, input: z.infer<typeof importSchema>): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;
  const db = getDb();
  for (const item of input.chapters) {
    const chapter = findPublished(item.chapterId);
    if (!chapter) {
      skipped++;
      continue;
    }
    const when = item.completedAt && !Number.isNaN(Date.parse(item.completedAt)) ? new Date(Math.min(Date.parse(item.completedAt), Date.now())) : new Date();
    if (item.completed) {
      await db.execute(sql`
        INSERT INTO progress (user_id, chapter_id, chapter_version, status, source, started_at, completed_at, completed_version, updated_at)
        VALUES (${userId}, ${chapter.id}, ${chapter.contentVersion}, 'completed', 'imported', ${when.toISOString()}, ${when.toISOString()}, ${Math.min(item.contentVersion, chapter.contentVersion)}, now())
        ON CONFLICT (user_id, chapter_id) DO UPDATE SET
          status = 'completed',
          completed_at = COALESCE(progress.completed_at, EXCLUDED.completed_at),
          completed_version = COALESCE(progress.completed_version, EXCLUDED.completed_version),
          updated_at = now()`);
    } else {
      await upsertStarted(userId, chapter.id, chapter.contentVersion);
    }
    imported++;
  }
  await db.execute(sql`
    INSERT INTO legacy_imports (user_id, imported_at, chapter_count) VALUES (${userId}, now(), ${imported})
    ON CONFLICT (user_id) DO UPDATE SET imported_at = now(), chapter_count = GREATEST(legacy_imports.chapter_count, ${imported})`);
  await touchSync(userId);
  await audit(db, { actorId: userId, groupId: null, action: "progress.import-legacy", targetUserId: userId, details: { count: imported } });
  return { imported, skipped };
}

/* -------------------------------------------------------- Lärarens översikt */

export type CellStatus = "none" | "started" | "completed";
export interface MatrixRow {
  userId: string;
  displayName: string;
  username: string | null;
  active: boolean;
  completedCount: number;
  cells: { status: CellStatus; selfReported: boolean; outdated: boolean }[];
  lastSyncedAt: string | null;
}

export async function groupOverview(groupId: string) {
  const db = getDb();
  const chapters = publishedChapters();
  const students = await db
    .select({ id: schema.user.id, name: schema.user.name, username: schema.user.username, deactivatedAt: schema.user.deactivatedAt })
    .from(schema.memberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.memberships.userId))
    .where(and(eq(schema.memberships.groupId, groupId), eq(schema.memberships.role, "student")))
    .orderBy(schema.user.name, schema.user.createdAt);
  const prog = await db
    .select({ userId: schema.progress.userId, chapterId: schema.progress.chapterId, status: schema.progress.status, source: schema.progress.source, completedVersion: schema.progress.completedVersion })
    .from(schema.progress)
    .innerJoin(schema.memberships, and(eq(schema.memberships.userId, schema.progress.userId), eq(schema.memberships.groupId, groupId)));
  const syncs = await db
    .select({ userId: schema.syncState.userId, at: schema.syncState.lastSyncedAt })
    .from(schema.syncState)
    .innerJoin(schema.memberships, and(eq(schema.memberships.userId, schema.syncState.userId), eq(schema.memberships.groupId, groupId)));
  const byKey = new Map(prog.map((p) => [`${p.userId}:${p.chapterId}`, p]));
  const syncBy = new Map(syncs.map((s) => [s.userId, s.at]));
  const rows: MatrixRow[] = students.map((s) => {
    const cells = chapters.map((c) => {
      const p = byKey.get(`${s.id}:${c.id}`);
      const status: CellStatus = !p ? "none" : p.status === "completed" ? "completed" : "started";
      return { status, selfReported: p?.source === "imported", outdated: status === "completed" && (p?.completedVersion ?? 0) < c.contentVersion };
    });
    return {
      userId: s.id,
      displayName: s.name,
      username: s.username,
      active: !s.deactivatedAt,
      completedCount: cells.filter((c) => c.status === "completed").length,
      cells,
      lastSyncedAt: syncBy.get(s.id)?.toISOString() ?? null,
    };
  });
  return { chapters: chapters.map((c) => ({ id: c.id, title: c.title })), publishedCount: chapters.length, rows };
}
