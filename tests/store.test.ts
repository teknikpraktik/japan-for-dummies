import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { progressStore } from "@/lib/store";
import { CORRUPT_BACKUP_KEY, STORAGE_KEY } from "@/lib/storage";

beforeEach(() => progressStore.__reset());
afterEach(() => {
  progressStore.__reset();
  // återställ ev. blockerad lagring
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).localStorage;
  Object.defineProperty(window, "localStorage", { configurable: true, value: realStorage });
});
const realStorage = window.localStorage;

describe("lagring", () => {
  it("sparar och återläser framsteg (som vid omladdning)", () => {
    progressStore.getSnapshot();
    progressStore.recordQuizResult("t01-k01", 1, 4);
    progressStore.toggleFavorite("t01-k01");
    expect(JSON.parse(realStorage.getItem(STORAGE_KEY)!).chapters["t01-k01"].best.score).toBe(4);

    progressStore.__reset(); // simulera ny sidladdning
    const snap = progressStore.getSnapshot();
    expect(snap.status).toBe("ok");
    expect(snap.state.chapters["t01-k01"].completedAt).toBeTruthy();
    expect(snap.state.favorites).toEqual(["t01-k01"]);
  });

  it("pågående test överlever omladdning", () => {
    progressStore.getSnapshot();
    progressStore.setDraft("t01-k01", { seed: 0, signature: "sig", answers: { q1: "b" }, finished: false });
    progressStore.__reset();
    expect(progressStore.getSnapshot().state.drafts["t01-k01"].answers).toEqual({ q1: "b" });
  });

  it("skadad lagring: krascher undviks, säkerhetskopia sparas, appen börjar om", () => {
    realStorage.setItem(STORAGE_KEY, "{trasig json");
    const snap = progressStore.getSnapshot();
    expect(snap.status).toBe("recovered");
    expect(snap.state.chapters).toEqual({});
    expect(realStorage.getItem(CORRUPT_BACKUP_KEY)).toBe("{trasig json");
    progressStore.recordQuizResult("a", 1, 5);
    expect(progressStore.getSnapshot().state.chapters.a.best?.score).toBe(5);
  });

  it("blockerad lagring: fungerar i minnet utan att kasta", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    const snap = progressStore.getSnapshot();
    expect(snap.status).toBe("unavailable");
    expect(() => progressStore.recordQuizResult("a", 1, 4)).not.toThrow();
    expect(progressStore.getSnapshot().state.chapters.a.completedAt).toBeTruthy();
  });

  it("skrivfel (fullt): status write-failed men minnestillståndet behålls", () => {
    progressStore.getSnapshot();
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    try {
      progressStore.recordQuizResult("a", 1, 4);
      const snap = progressStore.getSnapshot();
      expect(snap.status).toBe("write-failed");
      expect(snap.state.chapters.a.best?.score).toBe(4);
    } finally {
      Storage.prototype.setItem = orig;
    }
  });

  it("import: slå samman respektive ersätt", () => {
    progressStore.getSnapshot();
    progressStore.recordQuizResult("a", 1, 3);
    progressStore.mergeIn({ chapters: { a: { startedAt: "2026-11-01T00:00:00.000Z", contentVersion: 1, best: { score: 5, at: "2026-11-01T00:00:00.000Z" }, completedAt: "2026-11-01T00:00:00.000Z" } }, favorites: ["a"] });
    expect(progressStore.getSnapshot().state.chapters.a.best?.score).toBe(5);
    progressStore.replaceWith({ chapters: {}, favorites: [] });
    expect(progressStore.getSnapshot().state.chapters).toEqual({});
  });
});
