import { describe, expect, it } from "vitest";
import { cleanupOldPrivateData } from "@/sw/cleanup";

/** Minimal CacheStorage i minnet. */
function fakeCaches(initial: Record<string, string[]>) {
  const data = new Map(Object.entries(initial).map(([k, v]) => [k, new Set(v)]));
  const cache = (name: string) => ({
    keys: async () => [...(data.get(name) ?? [])].map((p) => new Request(`https://example.org${p}`)),
    delete: async (req: Request) => (data.get(name) ?? new Set()).delete(new URL(req.url).pathname),
  });
  const storage = {
    keys: async () => [...data.keys()],
    open: async (n: string) => cache(n),
    delete: async (n: string) => data.delete(n),
  } as unknown as CacheStorage;
  return { storage, data };
}

describe("rensning av gamla privata cachelager vid uppgradering", () => {
  it("tar bort privata sökvägar ur gamla offlinecachar men behåller utbildningsinnehåll", async () => {
    const { storage, data } = fakeCaches({
      "japanresan-offline-gammal": ["/", "/kapitel/arstider-och-klimat/", "/api/me/", "/min-utbildning/", "/lararen/", "/konto/", "/logga-in/", "/_next/static/a.js"],
    });
    await cleanupOldPrivateData(storage);
    expect([...data.get("japanresan-offline-gammal")!].sort()).toEqual(["/", "/_next/static/a.js", "/kapitel/arstider-och-klimat/"]);
  });

  it("tar bort okända cachar med tjänstens prefix men rör inte andra cachar", async () => {
    const { storage, data } = fakeCaches({ "japanresan-privat-v1": ["/api/me/"], "japanresan-offline-ny": ["/"], "annan-tjanst": ["/api/x"] });
    await cleanupOldPrivateData(storage);
    expect([...data.keys()].sort()).toEqual(["annan-tjanst", "japanresan-offline-ny"]);
  });
});
