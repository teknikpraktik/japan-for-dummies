// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Det kontofria läget (standard): konto-API och sidor är avstängda på servern, utan att autentisering eller
 * databas initieras, och utan miljövariablerna DATABASE_URL, DB_TARGET och BETTER_AUTH_SECRET.
 */
const DISABLED_ENV = ["DATABASE_URL", "DB_TARGET", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"] as const;
const saved: Record<string, string | undefined> = {};
let poolCreated = 0;

beforeEach(() => {
  for (const k of DISABLED_ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED = "false";
  poolCreated = 0;
  vi.resetModules();
  vi.doMock("pg", () => ({
    Pool: class {
      constructor() {
        poolCreated++;
      }
      on() {}
    },
  }));
});
afterEach(() => {
  for (const k of DISABLED_ENV) if (saved[k] === undefined) delete process.env[k];
  else process.env[k] = saved[k];
  process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED = "true";
  vi.doUnmock("pg");
  vi.resetModules();
});

const post = (url: string) => new Request(url, { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000", cookie: "better-auth.session_token=gammal.session" }, body: "{}" });
const get = (url: string) => new Request(url, { headers: { cookie: "better-auth.session_token=gammal.session" } });
const params = (p: Record<string, string> = {}) => ({ params: Promise.resolve(p) });

describe("kontofunktioner avstängda", () => {
  it("standardvärdet är avstängt", async () => {
    delete process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED;
    const { ACCOUNTS_ENABLED } = await import("@/lib/features");
    expect(ACCOUNTS_ENABLED).toBe(false);
  });

  it("alla konto-API:er svarar 404 utan databas, autentisering eller kakor, även med gammal session", async () => {
    const calls: [string, () => Promise<Response>][] = [
      ["me", async () => (await import("@/app/api/me/route")).GET(get("http://localhost:3000/api/me/"), params())],
      ["framsteg", async () => (await import("@/app/api/framsteg/route")).GET(get("http://localhost:3000/api/framsteg/"), params())],
      ["sync", async () => (await import("@/app/api/framsteg/sync/route")).POST(post("http://localhost:3000/api/framsteg/sync/"), params())],
      ["importera", async () => (await import("@/app/api/framsteg/importera/route")).POST(post("http://localhost:3000/api/framsteg/importera/"), params())],
      ["oversikt", async () => (await import("@/app/api/lararen/oversikt/route")).GET(get("http://localhost:3000/api/lararen/oversikt/"), params())],
      ["medlemmar", async () => (await import("@/app/api/lararen/medlemmar/route")).GET(get("http://localhost:3000/api/lararen/medlemmar/"), params())],
      ["elever", async () => (await import("@/app/api/lararen/elever/route")).POST(post("http://localhost:3000/api/lararen/elever/"), params())],
      ["larare", async () => (await import("@/app/api/lararen/larare/route")).POST(post("http://localhost:3000/api/lararen/larare/"), params())],
      ["aktivera", async () => (await import("@/app/api/aktivera/[token]/route")).POST(post("http://localhost:3000/api/aktivera/abc/"), params({ token: "abc" }))],
      ["auth GET", async () => (await import("@/app/api/auth/[...all]/route")).GET(get("http://localhost:3000/api/auth/get-session"))],
      ["auth POST", async () => (await import("@/app/api/auth/[...all]/route")).POST(post("http://localhost:3000/api/auth/sign-in/email"))],
    ];
    for (const [name, call] of calls) {
      const res = await call();
      expect(res.status, name).toBe(404);
      expect(res.headers.get("set-cookie"), name).toBeNull();
    }
    expect(poolCreated).toBe(0);
  });

  it("proxyn svarar 404 på konto-API och skickar kontosidor till 404-sidan, utan kakor", async () => {
    const { proxy } = await import("@/proxy");
    const { NextRequest } = await import("next/server");
    const api = proxy(new NextRequest("http://localhost:3000/api/auth/sign-in/email", { method: "POST" }));
    expect(api.status).toBe(404);
    expect(api.headers.get("set-cookie")).toBeNull();
    for (const path of ["/logga-in/", "/min-utbildning/", "/lararen/", "/lararen/elever/", "/konto/", "/konto/tvafaktor/", "/aktivera/abc/"]) {
      const res = proxy(new NextRequest(`http://localhost:3000${path}`, { headers: { cookie: "better-auth.session_token=gammal.session" } }));
      expect(res.headers.get("x-middleware-rewrite"), path).toContain("/finns-inte-konton-avstangda");
      expect(res.headers.get("set-cookie"), path).toBeNull();
    }
  });
});

describe("kontofunktioner påslagna (återaktivering)", () => {
  it("proxyn släpper igenom förfrågningar", async () => {
    process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED = "true";
    vi.resetModules();
    const { proxy } = await import("@/proxy");
    const { NextRequest } = await import("next/server");
    const res = proxy(new NextRequest("http://localhost:3000/api/me/"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
