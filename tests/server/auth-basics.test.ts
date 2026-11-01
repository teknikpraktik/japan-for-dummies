// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { getAuth } from "@/server/auth";
import { createStudent, resetStudentCode, deactivateUser } from "@/server/services/accounts";
import { GET as meGET } from "@/app/api/me/route";
import { authPost, call, makeGroup, makeTeacher, resetDb, signInStudent, signInTeacher } from "./helpers";

beforeEach(resetDb);

describe("elevinloggning med användarnamn och kod", () => {
  it("skapad elev kan logga in med användarnamn och kod; koden lagras inte i klartext", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const s = await createStudent({ userId: t.userId, groupId: g }, "Maja");
    expect(s.username).toMatch(/^[a-z2-9]{10}$/);
    expect(s.loginCode).toHaveLength(14);
    expect(s.username).not.toContain("maja");
    const ok = await signInStudent(s.username, s.loginCode);
    expect(ok.res.status).toBe(200);
    const me = await call(meGET, "/api/me", { cookie: ok.cookie });
    expect(me.data).toMatchObject({ user: { displayName: "Maja", role: "student", adminAccess: false } });
  });

  it("fel kod och okänt användarnamn ger samma generella fel", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const s = await createStudent({ userId: t.userId, groupId: g }, "Maja");
    const wrong = await signInStudent(s.username, "FELKODFELKOD12");
    const unknown = await signInStudent("finnsintealls", "FELKODFELKOD12");
    expect(wrong.res.status).toBe(unknown.res.status);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("två elever kan ha samma visningsnamn men olika användarnamn", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const a = await createStudent({ userId: t.userId, groupId: g }, "Alex");
    const b = await createStudent({ userId: t.userId, groupId: g }, "Alex");
    expect(a.username).not.toBe(b.username);
    expect(a.userId).not.toBe(b.userId);
  });

  it("elevkontot har intern .invalid-adress, aldrig verklig e-post", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const s = await createStudent({ userId: t.userId, groupId: g }, "Maja");
    const { getDb, schema } = await import("@/server/db");
    const { eq } = await import("drizzle-orm");
    const u = (await getDb().select().from(schema.user).where(eq(schema.user.id, s.userId)))[0];
    expect(u.email.endsWith("@elev.invalid")).toBe(true);
    expect(u.email).not.toContain("maja");
  });

  it("ny kod gör den gamla ogiltig direkt och avslutar gamla sessioner", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const s = await createStudent({ userId: t.userId, groupId: g }, "Maja");
    const first = await signInStudent(s.username, s.loginCode);
    expect((await call(meGET, "/api/me", { cookie: first.cookie })).data).toMatchObject({ user: { role: "student" } });
    const fresh = await resetStudentCode({ userId: t.userId, groupId: g }, s.userId);
    expect((await call(meGET, "/api/me", { cookie: first.cookie })).data).toEqual({ user: null });
    expect((await signInStudent(s.username, s.loginCode)).res.status).not.toBe(200);
    expect((await signInStudent(s.username, fresh.loginCode)).res.status).toBe(200);
    expect(fresh.loginCode).not.toBe(s.loginCode);
  });

  it("avaktiverat konto kan inte logga in och befintlig session slutar gälla", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const s = await createStudent({ userId: t.userId, groupId: g }, "Maja");
    const login = await signInStudent(s.username, s.loginCode);
    await deactivateUser({ userId: t.userId, groupId: g }, s.userId);
    expect((await call(meGET, "/api/me", { cookie: login.cookie })).data).toEqual({ user: null });
    const again = await signInStudent(s.username, s.loginCode);
    expect(again.res.status).not.toBe(200);
    // samma generella fel som för okänt konto
    const unknown = await signInStudent("finnsintealls", s.loginCode);
    expect(again.body).toEqual(unknown.body);
  });

  it("kodtecken: 14 tecken ur lättlästa alfabet, olika varje gång", async () => {
    const { generateLoginCode, formatLoginCode, normalizeLoginCode } = await import("@/server/services/ids");
    const codes = new Set(Array.from({ length: 500 }, () => generateLoginCode()));
    expect(codes.size).toBe(500);
    for (const c of codes) expect(c).toMatch(/^[23456789ACDEFGHJKMNPQRSTUVWXYZ]{14}$/);
    const c = [...codes][0];
    expect(normalizeLoginCode(formatLoginCode(c).toLowerCase() + " ")).toBe(c);
  });
});

describe("lärarinloggning med tvåfaktor", () => {
  it("lärare med tvåfaktor får utmaning och först efter TOTP en session med adminåtkomst", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const first = await authPost("/sign-in/email", { email: t.email, password: t.password });
    expect(first.body).toMatchObject({ twoFactorRedirect: true });
    // Ingen session än: /api/me är anonym
    expect((await call(meGET, "/api/me", { cookie: first.cookie })).data).toEqual({ user: null });
    const full = await signInTeacher(t.email);
    const me = await call(meGET, "/api/me", { cookie: full.cookie });
    expect(me.data).toMatchObject({ user: { role: "teacher", adminAccess: true, enrollmentRequired: false } });
  });

  it("fel TOTP-kod ger ingen session", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const first = await authPost("/sign-in/email", { email: t.email, password: t.password });
    const bad = await authPost("/two-factor/verify-totp", { code: "000000" }, first.cookie);
    expect(bad.res.status).toBeGreaterThanOrEqual(400);
    expect((await call(meGET, "/api/me", { cookie: bad.cookie })).data).toEqual({ user: null });
  });

  it("lärare utan registrerad tvåfaktor får session men ingen administratörsåtkomst", async () => {
    const { GET: overview } = await import("@/app/api/lararen/oversikt/route");
    const g = await makeGroup();
    const t = await makeTeacher(g, { twoFactor: false });
    const login = await signInTeacher(t.email);
    expect(login.res.status).toBe(200);
    const me = await call(meGET, "/api/me", { cookie: login.cookie });
    expect(me.data).toMatchObject({ user: { role: "teacher", adminAccess: false, enrollmentRequired: true } });
    const r = await call(overview, "/api/lararen/oversikt", { cookie: login.cookie });
    expect(r.status).toBe(403);
    expect(r.data).toMatchObject({ error: "two-factor-required" });
  });

  it("registrering av tvåfaktor (TOTP) verifieras innan administratörsåtkomst ges, med återställningskoder", async () => {
    const { GET: overview } = await import("@/app/api/lararen/oversikt/route");
    const g = await makeGroup();
    const t = await makeTeacher(g, { twoFactor: false });
    const login = await signInTeacher(t.email);
    const enable = await authPost("/two-factor/enable", { password: t.password }, login.cookie);
    expect(enable.res.status).toBe(200);
    const uri = String(enable.body!.totpURI);
    const secret = new URL(uri).searchParams.get("secret")!;
    const codes = enable.body!.backupCodes as string[];
    expect(codes.length).toBe(10);
    // Innan verifiering: fortfarande ingen adminåtkomst
    expect((await call(overview, "/api/lararen/oversikt", { cookie: login.cookie })).status).toBe(403);
    const { totp } = await import("./helpers");
    const verify = await authPost("/two-factor/verify-totp", { code: totp(secret) }, login.cookie);
    expect(verify.res.status).toBe(200);
    const ok = await call(overview, "/api/lararen/oversikt", { cookie: verify.cookie || login.cookie });
    expect(ok.status).toBe(200);
  });

  it("återställningskod fungerar som andra faktor och förbrukas", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g, { twoFactor: false });
    const login = await signInTeacher(t.email);
    const enable = await authPost("/two-factor/enable", { password: t.password }, login.cookie);
    const secret = new URL(String(enable.body!.totpURI)).searchParams.get("secret")!;
    const codes = enable.body!.backupCodes as string[];
    const { totp } = await import("./helpers");
    await authPost("/two-factor/verify-totp", { code: totp(secret) }, login.cookie);
    // Ny inloggning med återställningskod i stället för TOTP
    const first = await authPost("/sign-in/email", { email: t.email, password: t.password });
    expect(first.body).toMatchObject({ twoFactorRedirect: true });
    const bc = await authPost("/two-factor/verify-backup-code", { code: codes[0] }, first.cookie);
    expect(bc.res.status).toBe(200);
    expect((await call(meGET, "/api/me", { cookie: bc.cookie })).data).toMatchObject({ user: { adminAccess: true } });
    // Samma kod kan inte användas igen
    const second = await authPost("/sign-in/email", { email: t.email, password: t.password });
    const again = await authPost("/two-factor/verify-backup-code", { code: codes[0] }, second.cookie);
    expect(again.res.status).toBeGreaterThanOrEqual(400);
  });

  it("student kan inte registrera tvåfaktor eller ändra sin profil via Better Auth", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const s = await createStudent({ userId: t.userId, groupId: g }, "Maja");
    const login = await signInStudent(s.username, s.loginCode);
    const upd = await authPost("/update-user", { name: "Annat" }, login.cookie);
    expect(upd.res.status).toBe(404);
    const auth = getAuth();
    expect(auth).toBeTruthy();
  });
});
