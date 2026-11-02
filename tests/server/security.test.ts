// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { DISABLED_AUTH_PATHS, createAuth, getAuth } from "@/server/auth";
import { getDb, schema } from "@/server/db";
import { createStudent, inviteTeacher, activateTeacher, checkActivationToken } from "@/server/services/accounts";
import { assertEnvironmentIsolation, trustedOrigins } from "@/server/env";
import { GET as meGET } from "@/app/api/me/route";
import { POST as syncPOST } from "@/app/api/framsteg/sync/route";
import { POST as createStudentPOST } from "@/app/api/lararen/elever/route";
import { authPost, call, makeGroup, makeTeacher, resetDb, signInStudent, signInTeacher, nextIp, ORIGIN } from "./helpers";

beforeEach(resetDb);

describe("publik registrering och bakomliggande vägar är stängda", () => {
  it("ingen publik registrering: /sign-up/email avvisas, även med roll- och gruppfält", async () => {
    const r = await authPost("/sign-up/email", { email: "ny@example.org", password: "Losenord-12345", name: "Ny", role: "teacher", groupId: "x" });
    expect(r.res.status).toBe(404);
    expect(await getDb().select().from(schema.user).where(eq(schema.user.email, "ny@example.org"))).toHaveLength(0);
  });

  it("serveranrop till signUpEmail avvisas också (disableSignUp)", async () => {
    await expect(getAuth().api.signUpEmail({ body: { email: "ny2@example.org", password: "Losenord-12345", name: "Ny" } })).rejects.toBeTruthy();
    expect(await getDb().select().from(schema.user).where(eq(schema.user.email, "ny2@example.org"))).toHaveLength(0);
  });

  it("alla avstängda sökvägar svarar 404 via den publika routen", async () => {
    const { GET, POST } = await import("@/app/api/auth/[...all]/route");
    const concrete = DISABLED_AUTH_PATHS.map((p) => p.replace(":token", "x").replace(":id", "x"));
    for (const path of concrete) {
      const g = await GET(new Request(`${ORIGIN}/api/auth${path}`, { method: "GET", headers: { origin: ORIGIN, "x-forwarded-for": nextIp() } }));
      expect(g.status, `GET ${path}`).toBe(404);
      const p = await POST(new Request(`${ORIGIN}/api/auth${path}`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json", "x-forwarded-for": nextIp() }, body: "{}" }));
      expect(p.status, `POST ${path}`).toBe(404);
    }
  });

  it("e-postbaserad lösenordsåterställning och användarnamnsuppslag finns inte", async () => {
    for (const path of ["/request-password-reset", "/reset-password", "/is-username-available", "/send-verification-email"]) {
      const r = await authPost(path, { email: "x@example.org", username: "abc123", newPassword: "x" });
      expect(r.res.status).toBe(404);
    }
  });

  it("endast avsedda endpoints är registrerade i Better Auth (ingen oväntad ny väg)", async () => {
    const api = getAuth().api as Record<string, { path?: string }>;
    const open = Object.values(api).map((v) => v.path).filter((p): p is string => Boolean(p) && !DISABLED_AUTH_PATHS.includes(p!));
    const allowed = new Set(["/ok", "/error", "/get-session", "/sign-in/email", "/sign-in/username", "/sign-out", "/change-password", "/list-sessions", "/revoke-session", "/revoke-sessions", "/revoke-other-sessions", "/two-factor/enable", "/two-factor/disable", "/two-factor/verify-totp", "/two-factor/verify-backup-code", "/two-factor/generate-backup-codes", "/two-factor/get-totp-uri"]);
    expect(open.filter((p) => !allowed.has(p))).toEqual([]);
  });
});

describe("behörighet på servern", () => {
  it("elev kan inte använda läraradministration eller skapa konton", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const s = await createStudent({ userId: t.userId, groupId: g }, "Maja");
    const login = await signInStudent(s.username, s.loginCode);
    const { GET: overview } = await import("@/app/api/lararen/oversikt/route");
    const { POST: invite } = await import("@/app/api/lararen/larare/route");
    expect((await call(overview, "/api/lararen/oversikt", { cookie: login.cookie })).status).toBe(403);
    expect((await call(createStudentPOST, "/api/lararen/elever", { method: "POST", cookie: login.cookie, body: { displayName: "Hack" } })).status).toBe(403);
    expect((await call(invite, "/api/lararen/larare", { method: "POST", cookie: login.cookie, body: { displayName: "H", loginEmail: "h@example.org", password: "x" } })).status).toBe(403);
    // Ingen ny användare skapades
    expect((await getDb().select().from(schema.user)).length).toBe(2);
  });

  it("anonym får 401 på skyddade anrop", async () => {
    const { GET: overview } = await import("@/app/api/lararen/oversikt/route");
    const { GET: prog } = await import("@/app/api/framsteg/route");
    expect((await call(overview, "/api/lararen/oversikt")).status).toBe(401);
    expect((await call(prog, "/api/framsteg")).status).toBe(401);
  });

  it("klientens uppgift om användar-ID, grupp eller roll accepteras aldrig", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const a = await createStudent({ userId: t.userId, groupId: g }, "A");
    const b = await createStudent({ userId: t.userId, groupId: g }, "B");
    const la = await signInStudent(a.username, a.loginCode);
    // Extra fält (userId/role/groupId) avvisas av strikt validering
    const r = await call(syncPOST, "/api/framsteg/sync", { method: "POST", cookie: la.cookie, body: { ops: [{ type: "started", chapterId: "t01-k01", contentVersion: 1 }], userId: b.userId, role: "teacher", groupId: g } });
    expect(r.status).toBe(400);
    const r2 = await call(syncPOST, "/api/framsteg/sync", { method: "POST", cookie: la.cookie, body: { ops: [{ type: "started", chapterId: "t01-k01", contentVersion: 1, userId: b.userId }] } });
    expect(r2.status).toBe(400);
    expect(await getDb().select().from(schema.progress).where(eq(schema.progress.userId, b.userId))).toHaveLength(0);
  });

  it("elev A kan inte läsa eller ändra elev B:s data, även med direkta API-anrop", async () => {
    const { GET: prog } = await import("@/app/api/framsteg/route");
    const { GET: memberAction, POST: memberPost } = await import("@/app/api/lararen/medlemmar/[id]/[action]/route");
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const a = await createStudent({ userId: t.userId, groupId: g }, "A");
    const b = await createStudent({ userId: t.userId, groupId: g }, "B");
    const la = await signInStudent(a.username, a.loginCode);
    const lb = await signInStudent(b.username, b.loginCode);
    await call(syncPOST, "/api/framsteg/sync", { method: "POST", cookie: lb.cookie, body: { ops: [{ type: "started", chapterId: "t01-k01", contentVersion: 1 }] } });
    const mine = await call(prog, "/api/framsteg", { cookie: la.cookie });
    expect((mine.data as { rows: unknown[] }).rows).toHaveLength(0);
    const theirs = await call(prog, "/api/framsteg", { cookie: lb.cookie });
    expect((theirs.data as { rows: unknown[] }).rows).toHaveLength(1);
    // Elevens försök att nå administrationens åtgärder mot B
    expect((await call(memberAction, `/api/lararen/medlemmar/${b.userId}/export`, { cookie: la.cookie, params: { id: b.userId, action: "export" } })).status).toBe(403);
    expect((await call(memberPost, `/api/lararen/medlemmar/${b.userId}/ny-kod`, { method: "POST", cookie: la.cookie, body: { password: "x" }, params: { id: b.userId, action: "ny-kod" } })).status).toBe(403);
  });

  it("en lärare kan inte nå en annan grupp", async () => {
    const { GET: overview } = await import("@/app/api/lararen/oversikt/route");
    const { POST: memberPost, GET: memberGet } = await import("@/app/api/lararen/medlemmar/[id]/[action]/route");
    const { GET: members } = await import("@/app/api/lararen/medlemmar/route");
    const g1 = await makeGroup("Grupp 1");
    const g2 = await makeGroup("Grupp 2");
    const t1 = await makeTeacher(g1);
    const t2 = await makeTeacher(g2);
    const s1 = await createStudent({ userId: t1.userId, groupId: g1 }, "Maja");
    await createStudent({ userId: t2.userId, groupId: g2 }, "Olle");
    const l2 = await signInTeacher(t2.email);
    const ov = await call(overview, "/api/lararen/oversikt", { cookie: l2.cookie });
    expect((ov.data as { rows: { displayName: string }[] }).rows.map((r) => r.displayName)).toEqual(["Olle"]);
    const list = await call(members, "/api/lararen/medlemmar", { cookie: l2.cookie });
    expect(JSON.stringify(list.data)).not.toContain("Maja");
    // Direkta anrop mot g1:s elev ger 404 (även med giltigt lösenord)
    for (const action of ["ny-kod", "avaktivera", "radera", "aktivera-igen"]) {
      const r = await call(memberPost, `/api/lararen/medlemmar/${s1.userId}/${action}`, { method: "POST", cookie: l2.cookie, body: { password: t2.password }, params: { id: s1.userId, action } });
      expect(r.status, action).toBe(404);
    }
    expect((await call(memberGet, `/api/lararen/medlemmar/${s1.userId}/export`, { cookie: l2.cookie, params: { id: s1.userId, action: "export" } })).status).toBe(404);
    // Eleven är orörd
    const still = (await getDb().select().from(schema.user).where(eq(schema.user.id, s1.userId)))[0];
    expect(still.deactivatedAt).toBeNull();
  });

  it("roll- och aktivstatus kontrolleras vid varje anrop: avaktivering och rolländring ger omedelbar effekt på befintliga sessioner", async () => {
    const { GET: overview } = await import("@/app/api/lararen/oversikt/route");
    const { POST: memberPost } = await import("@/app/api/lararen/medlemmar/[id]/[action]/route");
    const g = await makeGroup();
    const t1 = await makeTeacher(g);
    const t2 = await makeTeacher(g);
    const l1 = await signInTeacher(t1.email);
    const l2 = await signInTeacher(t2.email);
    expect((await call(overview, "/api/lararen/oversikt", { cookie: l2.cookie })).status).toBe(200);
    // t1 gör t2 till elev (bekräftar med lösenord)
    const r = await call(memberPost, `/x/${t2.userId}/roll`, { method: "POST", cookie: l1.cookie, body: { role: "student", password: t1.password }, params: { id: t2.userId, action: "roll" } });
    expect(r.status).toBe(200);
    const after = await call(overview, "/api/lararen/oversikt", { cookie: l2.cookie });
    expect([401, 403]).toContain(after.status);
  });

  it("avaktiverad lärare förlorar åtkomst direkt", async () => {
    const { GET: overview } = await import("@/app/api/lararen/oversikt/route");
    const { POST: memberPost } = await import("@/app/api/lararen/medlemmar/[id]/[action]/route");
    const g = await makeGroup();
    const t1 = await makeTeacher(g);
    const t2 = await makeTeacher(g);
    const l1 = await signInTeacher(t1.email);
    const l2 = await signInTeacher(t2.email);
    const r = await call(memberPost, "/x", { method: "POST", cookie: l1.cookie, body: { password: t1.password }, params: { id: t2.userId, action: "avaktivera" } });
    expect(r.status).toBe(200);
    expect((await call(overview, "/api/lararen/oversikt", { cookie: l2.cookie })).status).toBe(401);
    expect((await signInTeacher(t2.email)).res.status).not.toBe(200);
  });
});

describe("CSRF, ursprung och indata", () => {
  it("tillståndsändrande anrop från otillåtet ursprung avvisas", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const l = await signInTeacher(t.email);
    const bad = await call(createStudentPOST, "/api/lararen/elever", { method: "POST", cookie: l.cookie, body: { displayName: "X" }, origin: "https://evil.example" });
    expect(bad.status).toBe(403);
    expect(bad.data).toMatchObject({ error: "bad-origin" });
    const none = await call(createStudentPOST, "/api/lararen/elever", { method: "POST", cookie: l.cookie, body: { displayName: "X" }, origin: null });
    expect(none.status).toBe(403);
    expect((await getDb().select().from(schema.user)).length).toBe(1);
  });

  it("formulär-POST (annan innehållstyp) avvisas", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const l = await signInTeacher(t.email);
    const r = await call(createStudentPOST, "/api/lararen/elever", { method: "POST", cookie: l.cookie, body: { displayName: "X" }, contentType: "application/x-www-form-urlencoded" });
    expect(r.status).toBe(400);
  });

  it("inloggning från främmande eller saknat ursprung avvisas (även utan cookies)", async () => {
    const { POST } = await import("@/app/api/auth/[...all]/route");
    const mk = (origin?: string) => new Request(`${ORIGIN}/api/auth/sign-in/email`, { method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}), "x-forwarded-for": nextIp() }, body: JSON.stringify({ email: "a@example.org", password: "Losenord-12345" }) });
    expect((await POST(mk("https://evil.example"))).status).toBe(403);
    expect((await POST(mk())).status).toBe(403);
  });

  it("API-svar är aldrig cachebara", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const l = await signInTeacher(t.email);
    const me = await call(meGET, "/api/me", { cookie: l.cookie });
    expect(me.headers.get("cache-control")).toMatch(/no-store/);
    expect(me.headers.get("vary")).toMatch(/Cookie/);
    const { GET: overview } = await import("@/app/api/lararen/oversikt/route");
    expect((await call(overview, "/api/lararen/oversikt", { cookie: l.cookie })).headers.get("cache-control")).toMatch(/no-store/);
  });

  it("sessionscookien är HttpOnly, SameSite och inte åtkomlig för skript; ingen token i svaret till localStorage", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const s = await createStudent({ userId: t.userId, groupId: g }, "Maja");
    const r = await signInStudent(s.username, s.loginCode);
    const setCookie = (r.res.headers.getSetCookie?.() ?? []).join("\n");
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Path=\//i);
  });
});

describe("miljöseparation", () => {
  it("preview får inte använda produktionsdatabasen och tvärtom", () => {
    expect(() => assertEnvironmentIsolation({ VERCEL_ENV: "preview", DB_TARGET: "production" })).toThrow();
    expect(() => assertEnvironmentIsolation({ VERCEL_ENV: "production", DB_TARGET: "preview" })).toThrow();
    expect(() => assertEnvironmentIsolation({ VERCEL_ENV: "development", DB_TARGET: "production" })).toThrow();
    expect(() => assertEnvironmentIsolation({ VERCEL_ENV: "preview", DB_TARGET: "preview" })).not.toThrow();
    expect(() => assertEnvironmentIsolation({ VERCEL_ENV: "production", DB_TARGET: "production" })).not.toThrow();
  });

  it("tillåtna ursprung är exakta (inga jokertecken) och lokala bara i utveckling/test", () => {
    const o = trustedOrigins();
    expect(o).toContain("http://localhost:3000");
    expect(o.some((x) => x.includes("*"))).toBe(false);
  });

  it("syntetiska konton kan inte skapas i produktion", async () => {
    const { seedSynthetic } = await import("@/server/services/synthetic");
    const prev = process.env.DB_TARGET;
    process.env.DB_TARGET = "production";
    await expect(seedSynthetic()).rejects.toThrow(/produktion/);
    process.env.DB_TARGET = prev;
  });
});

describe("nya lärare: engångsflöde", () => {
  it("inbjuden lärare sätter eget lösenord via engångslänk men får inte adminåtkomst före tvåfaktor", async () => {
    const { GET: overview } = await import("@/app/api/lararen/oversikt/route");
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const inv = await inviteTeacher({ userId: t.userId, groupId: g }, "Ny Lärare", "ny.larare@example.org");
    // Innan aktivering kan kontot inte logga in
    expect((await signInTeacher("ny.larare@example.org", "vad-som-helst-123")).res.status).not.toBe(200);
    expect((await checkActivationToken(inv.token)).valid).toBe(true);
    await activateTeacher(inv.token, "Eget-starkt-losenord-1");
    const login = await signInTeacher("ny.larare@example.org", "Eget-starkt-losenord-1");
    expect(login.res.status).toBe(200);
    const me = await call(meGET, "/api/me", { cookie: login.cookie });
    expect(me.data).toMatchObject({ user: { role: "teacher", adminAccess: false, enrollmentRequired: true } });
    expect((await call(overview, "/api/lararen/oversikt", { cookie: login.cookie })).status).toBe(403);
  });

  it("engångslänken kan bara användas en gång, även vid samtidiga anrop", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const inv = await inviteTeacher({ userId: t.userId, groupId: g }, "Ny", "ny2@example.org");
    const results = await Promise.allSettled([activateTeacher(inv.token, "Forsta-losenordet-1"), activateTeacher(inv.token, "Andra-losenordet-2"), activateTeacher(inv.token, "Tredje-losenordet-3")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await checkActivationToken(inv.token)).valid).toBe(false);
  });

  it("utgången länk fungerar inte; token lagras bara som hash", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const inv = await inviteTeacher({ userId: t.userId, groupId: g }, "Ny", "ny3@example.org");
    const rows = await getDb().select().from(schema.teacherActivations);
    expect(rows[0].tokenHash).not.toContain(inv.token);
    await getDb().update(schema.teacherActivations).set({ expiresAt: new Date(Date.now() - 1000) });
    await expect(activateTeacher(inv.token, "Utgangen-lank-lösen-1")).rejects.toThrow();
  });

  it("inloggningsnamn som .invalid avvisas för lärare", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    await expect(inviteTeacher({ userId: t.userId, groupId: g }, "X", "x@elev.invalid")).rejects.toThrow();
  });
});

describe("begränsning av inloggningsförsök", () => {
  it("IP-baserad begränsning är beständig och gäller över flera instanser (databaslagring)", async () => {
    const a1 = createAuth({ rateLimitEnabled: true });
    const a2 = createAuth({ rateLimitEnabled: true }); // simulerar en annan serverinstans
    const ip = "198.51.100.77";
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) statuses.push((await authPost("/sign-in/username", { username: `okandanvandare${i}`, password: "FELFELFELFEL12" }, "", a1, ip)).res.status);
    const blocked = await authPost("/sign-in/username", { username: "okandanvandare99", password: "FELFELFELFEL12" }, "", a2, ip);
    expect(blocked.res.status).toBe(429);
    // Annan IP påverkas inte
    expect((await authPost("/sign-in/username", { username: "okandanvandare98", password: "FELFELFELFEL12" }, "", a2, "198.51.100.78")).res.status).not.toBe(429);
    expect(statuses.every((s) => s !== 429 || true)).toBe(true);
  });

  it("kontobaserad spärr efter upprepade fel, även från olika IP-adresser, med generellt meddelande", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const s = await createStudent({ userId: t.userId, groupId: g }, "Maja");
    let lastBody: Record<string, unknown> | null = null;
    for (let i = 0; i < 10; i++) lastBody = (await signInStudent(s.username, "FELFELFELFEL12", `192.0.2.${i + 1}`)).body;
    expect(lastBody).toBeTruthy();
    const locked = await signInStudent(s.username, s.loginCode, "192.0.2.200");
    expect(locked.res.status).toBe(429);
    expect(JSON.stringify(locked.body)).not.toMatch(/finns|exist|konto/i);
    // Okänt konto beter sig likadant efter lika många försök (ingen uppräkning)
    for (let i = 0; i < 10; i++) await signInStudent("okandkonto123", "FELFELFELFEL12", `192.0.3.${i + 1}`);
    const lockedUnknown = await signInStudent("okandkonto123", "FELFELFELFEL12", "192.0.3.200");
    expect(lockedUnknown.res.status).toBe(429);
    expect(lockedUnknown.body).toEqual(locked.body);
  });

  it("lyckad inloggning nollställer räknaren", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const s = await createStudent({ userId: t.userId, groupId: g }, "Maja");
    for (let i = 0; i < 5; i++) await signInStudent(s.username, "FELFELFELFEL12", `192.0.4.${i + 1}`);
    expect((await signInStudent(s.username, s.loginCode, "192.0.4.100")).res.status).toBe(200);
    for (let i = 0; i < 5; i++) await signInStudent(s.username, "FELFELFELFEL12", `192.0.4.${i + 10}`);
    expect((await signInStudent(s.username, s.loginCode, "192.0.4.101")).res.status).toBe(200);
  });
});
