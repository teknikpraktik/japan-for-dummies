// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { createStudent } from "@/server/services/accounts";
import { applyOps, getOwnProgress, groupOverview, publishedChapters, importLegacy } from "@/server/services/progress";
import { GET as progGET } from "@/app/api/framsteg/route";
import { POST as syncPOST } from "@/app/api/framsteg/sync/route";
import { POST as importPOST } from "@/app/api/framsteg/importera/route";
import { GET as overviewGET } from "@/app/api/lararen/oversikt/route";
import { call, makeGroup, makeTeacher, resetDb, signInStudent, signInTeacher } from "./helpers";

beforeEach(resetDb);

async function setup() {
  const g = await makeGroup();
  const t = await makeTeacher(g);
  const s = await createStudent({ userId: t.userId, groupId: g }, "Maja");
  const login = await signInStudent(s.username, s.loginCode);
  return { g, t, s, login };
}
const ch = () => publishedChapters()[0];
const correctAnswers = (c = ch(), wrong = 0) => Object.fromEntries(c.quiz.map((q, i) => [q.id, (q.options.find((o) => Boolean(o.correct) !== i < wrong) ?? q.options[0]).id]));

describe("framsteg: validering och regler på servern", () => {
  it("de 54 planerade kapitlen räknas inte; bara de 6 publicerade finns som uppgifter", () => {
    expect(publishedChapters()).toHaveLength(6);
  });

  it("fyra rätt ger avklarat, tre rätt gör det inte; servern räknar själv ur svaren", async () => {
    const { s } = await setup();
    const c = ch();
    expect((await applyOps(s.userId, [{ type: "completed", chapterId: c.id, contentVersion: c.contentVersion, answers: correctAnswers(c, 2) }]))[0].result).toBe("not-passed");
    expect((await getOwnProgress(s.userId)).rows[0].status).toBe("started");
    expect((await applyOps(s.userId, [{ type: "completed", chapterId: c.id, contentVersion: c.contentVersion, answers: correctAnswers(c, 1) }]))[0].result).toBe("ok");
    const row = (await getOwnProgress(s.userId)).rows[0];
    expect(row.status).toBe("completed");
    expect(row.completedAt).toBeTruthy();
    expect(row.source).toBe("quiz");
  });

  it("klientens påstådda resultat räcker inte: svar som inte ger fyra rätt avvisas", async () => {
    const { s } = await setup();
    const c = ch();
    const allWrong = Object.fromEntries(c.quiz.map((q) => [q.id, q.options.find((o) => !o.correct)!.id]));
    expect((await applyOps(s.userId, [{ type: "completed", chapterId: c.id, contentVersion: c.contentVersion, answers: allWrong }]))[0].result).toBe("not-passed");
    expect((await getOwnProgress(s.userId)).rows[0].status).toBe("started");
  });

  it("okänt, planerat och påhittat kapitel avvisas", async () => {
    const { s } = await setup();
    const results = await applyOps(s.userId, [
      { type: "started", chapterId: "t03-k01", contentVersion: 0 },
      { type: "started", chapterId: "finns-inte", contentVersion: 1 },
    ]);
    expect(results.map((r) => r.result)).toEqual(["unknown-chapter", "unknown-chapter"]);
    expect((await getOwnProgress(s.userId)).rows).toHaveLength(0);
  });

  it("ändrad kapitelversion: avklarad status på gammal version förloras inte, men gammalt test kan inte bekräftas", async () => {
    const { s } = await setup();
    const c = ch();
    await applyOps(s.userId, [{ type: "completed", chapterId: c.id, contentVersion: c.contentVersion, answers: correctAnswers(c) }]);
    // Simulera ett test gjort på äldre version
    const stale = await applyOps(s.userId, [{ type: "completed", chapterId: c.id, contentVersion: c.contentVersion + 1, answers: correctAnswers(c) }]);
    expect(stale[0].result).toBe("version-mismatch");
    expect((await getOwnProgress(s.userId)).rows[0].status).toBe("completed");
    // Kapitlet uppdateras: statusen finns kvar men markeras som avklarad på äldre version
    await getDb().update(schema.progress).set({ completedVersion: 0 }).where(eq(schema.progress.userId, s.userId));
    const row = (await getOwnProgress(s.userId)).rows[0];
    expect(row.status).toBe("completed");
    expect(row.outdated).toBe(true);
  });

  it("avklarat återgår aldrig till påbörjat (startad-anrop och misslyckat test rör inte avklarat)", async () => {
    const { s } = await setup();
    const c = ch();
    await applyOps(s.userId, [{ type: "completed", chapterId: c.id, contentVersion: c.contentVersion, answers: correctAnswers(c) }]);
    const before = (await getOwnProgress(s.userId)).rows[0];
    await applyOps(s.userId, [{ type: "started", chapterId: c.id, contentVersion: c.contentVersion }]);
    await applyOps(s.userId, [{ type: "completed", chapterId: c.id, contentVersion: c.contentVersion, answers: correctAnswers(c, 3) }]);
    const after = (await getOwnProgress(s.userId)).rows[0];
    expect(after.status).toBe("completed");
    expect(after.completedAt).toBe(before.completedAt);
  });

  it("synkning är idempotent: upprepade och samtidiga anrop ger en rad och samma slutresultat", async () => {
    const { s, login } = await setup();
    const c = ch();
    const body = { ops: [{ type: "started", chapterId: c.id, contentVersion: c.contentVersion }, { type: "completed", chapterId: c.id, contentVersion: c.contentVersion, answers: correctAnswers(c) }] };
    const res = await Promise.all(Array.from({ length: 6 }, () => call(syncPOST, "/api/framsteg/sync", { method: "POST", cookie: login.cookie, body })));
    expect(res.every((r) => r.status === 200)).toBe(true);
    const rows = await getDb().select().from(schema.progress).where(eq(schema.progress.userId, s.userId));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("completed");
  });

  it("centralt lagras inga svar, klick eller försökshistorik", async () => {
    const { s, login } = await setup();
    const c = ch();
    await call(syncPOST, "/api/framsteg/sync", { method: "POST", cookie: login.cookie, body: { ops: [{ type: "completed", chapterId: c.id, contentVersion: c.contentVersion, answers: correctAnswers(c, 1) }] } });
    const dump = JSON.stringify(await getDb().select().from(schema.progress));
    for (const q of c.quiz) expect(dump).not.toContain(q.id);
    const cols = Object.keys((await getDb().select().from(schema.progress).where(eq(schema.progress.userId, s.userId)))[0]);
    expect(cols.sort()).toEqual(["chapterId", "chapterVersion", "completedAt", "completedVersion", "source", "startedAt", "status", "updatedAt", "userId"]);
  });

  it("lärare kan inte skriva framsteg (bara elever har egna framsteg)", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const l = await signInTeacher(t.email);
    const c = ch();
    expect((await call(syncPOST, "/api/framsteg/sync", { method: "POST", cookie: l.cookie, body: { ops: [{ type: "started", chapterId: c.id, contentVersion: c.contentVersion }] } })).status).toBe(403);
    expect((await call(progGET, "/api/framsteg", { cookie: l.cookie })).status).toBe(403);
  });
});

describe("äldre lokala framsteg: uttrycklig, idempotent import", () => {
  const items = () => [
    { chapterId: ch().id, contentVersion: ch().contentVersion, completed: true, completedAt: "2026-10-01T10:00:00.000Z" },
    { chapterId: publishedChapters()[1].id, contentVersion: 1, completed: false },
    { chapterId: "t03-k01", contentVersion: 0, completed: true },
  ];

  it("kräver confirm: true (ingen automatisk import)", async () => {
    const { login } = await setup();
    const r = await call(importPOST, "/api/framsteg/importera", { method: "POST", cookie: login.cookie, body: { chapters: items() } });
    expect(r.status).toBe(400);
    const r2 = await call(importPOST, "/api/framsteg/importera", { method: "POST", cookie: login.cookie, body: { confirm: false, chapters: items() } });
    expect(r2.status).toBe(400);
  });

  it("importerar som självrapporterat, hoppar över planerade kapitel och kan upprepas utan dubbletter", async () => {
    const { s, login } = await setup();
    const body = { confirm: true, chapters: items() };
    const r1 = await call(importPOST, "/api/framsteg/importera", { method: "POST", cookie: login.cookie, body });
    expect(r1.status).toBe(200);
    expect(r1.data).toMatchObject({ imported: 2, skipped: 1 });
    const r2 = await call(importPOST, "/api/framsteg/importera", { method: "POST", cookie: login.cookie, body });
    expect(r2.status).toBe(200);
    const rows = await getDb().select().from(schema.progress).where(eq(schema.progress.userId, s.userId));
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.status === "completed")?.source).toBe("imported");
    expect(await getDb().select().from(schema.legacyImports).where(eq(schema.legacyImports.userId, s.userId))).toHaveLength(1);
  });

  it("import ändrar aldrig en redan bekräftad status och kan inte försämra den", async () => {
    const { s } = await setup();
    const c = ch();
    await applyOps(s.userId, [{ type: "completed", chapterId: c.id, contentVersion: c.contentVersion, answers: correctAnswers(c) }]);
    const before = (await getOwnProgress(s.userId)).rows[0];
    await importLegacy(s.userId, { confirm: true, chapters: [{ chapterId: c.id, contentVersion: c.contentVersion, completed: false }] });
    const after = (await getOwnProgress(s.userId)).rows[0];
    expect(after).toEqual(before);
    expect(after.source).toBe("quiz");
  });

  it("senare bekräftat test ersätter en självrapporterad status (källan blir quiz)", async () => {
    const { s } = await setup();
    const c = ch();
    await importLegacy(s.userId, { confirm: true, chapters: [{ chapterId: c.id, contentVersion: c.contentVersion, completed: true }] });
    expect((await getOwnProgress(s.userId)).rows[0].source).toBe("imported");
    await applyOps(s.userId, [{ type: "completed", chapterId: c.id, contentVersion: c.contentVersion, answers: correctAnswers(c) }]);
    expect((await getOwnProgress(s.userId)).rows[0].source).toBe("quiz");
  });
});

describe("lärarens översikt", () => {
  it("en rad per elev, en kolumn per publicerat kapitel, antal avklarade, senaste synk och markering av självrapporterat", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const a = await createStudent({ userId: t.userId, groupId: g }, "A");
    const b = await createStudent({ userId: t.userId, groupId: g }, "B");
    const [c0, c1] = publishedChapters();
    await applyOps(a.userId, [{ type: "completed", chapterId: c0.id, contentVersion: c0.contentVersion, answers: correctAnswers(c0) }, { type: "started", chapterId: c1.id, contentVersion: c1.contentVersion }]);
    await importLegacy(b.userId, { confirm: true, chapters: [{ chapterId: c0.id, contentVersion: c0.contentVersion, completed: true }] });
    const l = await signInTeacher(t.email);
    const r = await call(overviewGET, "/api/lararen/oversikt", { cookie: l.cookie });
    const data = r.data as { publishedCount: number; chapters: unknown[]; rows: { displayName: string; completedCount: number; cells: { status: string; selfReported: boolean }[]; lastSyncedAt: string | null }[] };
    expect(data.publishedCount).toBe(6);
    expect(data.chapters).toHaveLength(6);
    expect(data.rows).toHaveLength(2);
    const ra = data.rows.find((x) => x.displayName === "A")!;
    expect(ra.cells).toHaveLength(6);
    expect(ra.cells.map((c) => c.status).slice(0, 2)).toEqual(["completed", "started"]);
    expect(ra.completedCount).toBe(1);
    expect(ra.lastSyncedAt).toBeTruthy();
    const rb = data.rows.find((x) => x.displayName === "B")!;
    expect(rb.cells[0]).toMatchObject({ status: "completed", selfReported: true });
    // Matrisen innehåller inga detaljer utöver status
    expect(Object.keys(ra).sort()).toEqual(["active", "cells", "completedCount", "displayName", "lastSyncedAt", "userId", "username"]);
  });

  it("översikten visar inte elever i andra grupper", async () => {
    const g1 = await makeGroup("G1");
    const g2 = await makeGroup("G2");
    const t1 = await makeTeacher(g1);
    const t2 = await makeTeacher(g2);
    await createStudent({ userId: t2.userId, groupId: g2 }, "Annan");
    const ov = await groupOverview(g1);
    expect(ov.rows).toHaveLength(0);
    expect(t1.userId).toBeTruthy();
  });
});
