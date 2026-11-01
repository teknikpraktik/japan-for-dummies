import { describe, expect, it } from "vitest";
import { APP_ID, buildExport, MAX_IMPORT_BYTES, parseImport } from "@/lib/transfer";
import { emptyState, recordQuizResult, toggleFavorite } from "@/lib/progress";

const state = toggleFavorite(recordQuizResult(emptyState(), "t01-k01", 1, 4, new Date("2026-11-01T10:00:00Z")), "t01-k01");

describe("export och import", () => {
  it("rundresa: exporterad fil går att importera och är identisk", () => {
    const text = JSON.stringify(buildExport(state, new Date("2026-11-02T10:00:00Z")));
    const r = parseImport(text);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.chapters).toEqual(state.chapters);
      expect(r.data.favorites).toEqual(state.favorites);
    }
  });
  it("exporten innehåller inte pågående testutkast", () => {
    const withDraft = { ...state, drafts: { "t01-k01": { seed: 1, signature: "s", answers: { q1: "a" }, finished: false } } };
    expect(JSON.stringify(buildExport(withDraft))).not.toContain("signature");
  });
  it("avvisar ogiltig JSON", () => {
    const r = parseImport("det här är inte json");
    expect(r).toMatchObject({ ok: false });
  });
  it("avvisar tom fil", () => expect(parseImport("")).toMatchObject({ ok: false }));
  it("avvisar fel app", () => {
    const r = parseImport(JSON.stringify({ app: "annan-app", dataVersion: 1, exportedAt: "x", data: {} }));
    expect(r).toMatchObject({ ok: false });
  });
  it("avvisar nyare dataversion", () => {
    const r = parseImport(JSON.stringify({ app: APP_ID, dataVersion: 2, exportedAt: "x", data: { chapters: {}, favorites: [] } }));
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("nyare") });
  });
  it("avvisar dataversion 0", () => {
    const r = parseImport(JSON.stringify({ app: APP_ID, dataVersion: 0, exportedAt: "x", data: { chapters: {}, favorites: [] } }));
    expect(r).toMatchObject({ ok: false });
  });
  it("avvisar för stor fil innan tolkning", () => {
    const r = parseImport("{}", MAX_IMPORT_BYTES + 1);
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("för stor") });
  });
  it("avvisar orimliga värden (poäng 9, ogiltigt kapitel-ID)", () => {
    const bad = (chapters: unknown) =>
      parseImport(JSON.stringify({ app: APP_ID, dataVersion: 1, exportedAt: "x", data: { chapters, favorites: [] } }));
    expect(bad({ a: { startedAt: "2026-11-01T00:00:00Z", contentVersion: 1, best: { score: 9, at: "2026-11-01T00:00:00Z" } } })).toMatchObject({ ok: false });
    expect(bad({ "<script>": { startedAt: "2026-11-01T00:00:00Z", contentVersion: 1 } })).toMatchObject({ ok: false });
    expect(bad({ a: { startedAt: "inte-ett-datum", contentVersion: 1 } })).toMatchObject({ ok: false });
  });
});
