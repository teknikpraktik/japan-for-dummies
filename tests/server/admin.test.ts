// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { AdminError, changeRole, createStudent, deactivateUser, deleteMember, inviteTeacher, activateTeacher, resetStudentCode } from "@/server/services/accounts";
import { bootstrapFirstTeacher, operatorResetTeacher } from "@/server/services/bootstrap";
import { POST as createStudentPOST } from "@/app/api/lararen/elever/route";
import { POST as inviteTeacherPOST } from "@/app/api/lararen/larare/route";
import { GET as membersGET } from "@/app/api/lararen/medlemmar/route";
import { GET as memberGET, POST as memberPOST } from "@/app/api/lararen/medlemmar/[id]/[action]/route";
import { call, makeGroup, makeTeacher, resetDb, signInStudent, signInTeacher, TEACHER_PASSWORD } from "./helpers";

beforeEach(resetDb);

const actor = (userId: string, groupId: string) => ({ userId, groupId });

describe("läraradministration via API", () => {
  it("lärare skapar elev; koden visas en gång och finns inte i klartext någonstans i databasen", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const l = await signInTeacher(t.email);
    const r = await call(createStudentPOST, "/api/lararen/elever", { method: "POST", cookie: l.cookie, body: { displayName: "Maja" } });
    expect(r.status).toBe(201);
    const code = String(r.data!.loginCode);
    expect(code).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){2}-[A-Z0-9]{2}$/);
    const plain = code.replace(/-/g, "");
    // Koden finns inte i klartext i någon tabell
    const dump = JSON.stringify({
      users: await getDb().select().from(schema.user),
      accounts: await getDb().select().from(schema.account),
      audit: await getDb().select().from(schema.auditLog),
      sessions: await getDb().select().from(schema.session),
    });
    expect(dump).not.toContain(plain);
    expect(dump).not.toContain(code);
    // Eleven kan logga in med koden (med och utan bindestreck normaliserat av klienten)
    expect((await signInStudent(String(r.data!.username), plain)).res.status).toBe(200);
    // Svaret när man listar innehåller aldrig kod
    const list = await call(membersGET, "/api/lararen/medlemmar", { cookie: l.cookie });
    expect(JSON.stringify(list.data)).not.toContain(plain);
  });

  it("känsliga åtgärder kräver lösenordsbekräftelse (ny autentisering)", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const s = await createStudent(actor(t.userId, g), "Maja");
    const l = await signInTeacher(t.email);
    const p = { id: s.userId, action: "ny-kod" };
    expect((await call(memberPOST, "/x", { method: "POST", cookie: l.cookie, body: { password: "" }, params: p })).status).toBe(403);
    const wrong = await call(memberPOST, "/x", { method: "POST", cookie: l.cookie, body: { password: "fel-losenord-123" }, params: p });
    expect(wrong.status).toBe(403);
    expect(wrong.data).toMatchObject({ error: "reauth-failed" });
    // Eleven är orörd
    expect((await signInStudent(s.username, s.loginCode)).res.status).toBe(200);
    const ok = await call(memberPOST, "/x", { method: "POST", cookie: l.cookie, body: { password: TEACHER_PASSWORD }, params: p });
    expect(ok.status).toBe(200);
    expect(ok.data!.loginCode).toBeTruthy();
  });

  it("upprepade fel lösenord vid bekräftelse spärras", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const s = await createStudent(actor(t.userId, g), "Maja");
    const l = await signInTeacher(t.email);
    for (let i = 0; i < 10; i++) await call(memberPOST, "/x", { method: "POST", cookie: l.cookie, body: { password: "fel-losenord-123" }, params: { id: s.userId, action: "ny-kod" } });
    const blocked = await call(memberPOST, "/x", { method: "POST", cookie: l.cookie, body: { password: TEACHER_PASSWORD }, params: { id: s.userId, action: "ny-kod" } });
    expect(blocked.status).toBe(429);
  });

  it("skapa lärare via API: kräver bekräftelse och ger engångslänk (token lagras inte)", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const l = await signInTeacher(t.email);
    const no = await call(inviteTeacherPOST, "/api/lararen/larare", { method: "POST", cookie: l.cookie, body: { displayName: "Ny", loginEmail: "ny@example.org", password: "fel-losenord-123" } });
    expect(no.status).toBe(403);
    const yes = await call(inviteTeacherPOST, "/api/lararen/larare", { method: "POST", cookie: l.cookie, body: { displayName: "Ny", loginEmail: "ny@example.org", password: TEACHER_PASSWORD } });
    expect(yes.status).toBe(201);
    const path = String(yes.data!.activationPath);
    const token = path.split("/")[2];
    const rows = await getDb().select().from(schema.teacherActivations);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it("export av en elevs uppgifter innehåller inga koder och loggas", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const s = await createStudent(actor(t.userId, g), "Maja");
    const l = await signInTeacher(t.email);
    const r = await call(memberGET, "/x", { cookie: l.cookie, params: { id: s.userId, action: "export" } });
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.data)).not.toContain(s.loginCode);
    expect(r.data).toMatchObject({ account: { displayName: "Maja", role: "student" } });
    const log = await getDb().select().from(schema.auditLog).where(eq(schema.auditLog.action, "student.export"));
    expect(log).toHaveLength(1);
  });

  it("radering tar bort kontot och dess framsteg men lämnar bara pseudonymt ID i säkerhetsloggen", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const s = await createStudent(actor(t.userId, g), "Maja");
    await getDb().insert(schema.progress).values({ userId: s.userId, chapterId: "t01-k01", chapterVersion: 1, status: "completed", source: "quiz" });
    await deleteMember(actor(t.userId, g), s.userId);
    expect(await getDb().select().from(schema.user).where(eq(schema.user.id, s.userId))).toHaveLength(0);
    expect(await getDb().select().from(schema.progress).where(eq(schema.progress.userId, s.userId))).toHaveLength(0);
    expect(await getDb().select().from(schema.account).where(eq(schema.account.userId, s.userId))).toHaveLength(0);
    const log = JSON.stringify(await getDb().select().from(schema.auditLog));
    expect(log).not.toContain("Maja");
    expect(log).toContain(s.userId);
  });

  it("säkerhetsloggen innehåller händelser men aldrig hemligheter eller namn", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const s = await createStudent(actor(t.userId, g), "Maja");
    await resetStudentCode(actor(t.userId, g), s.userId);
    await deactivateUser(actor(t.userId, g), s.userId);
    const inv = await inviteTeacher(actor(t.userId, g), "Ny", "ny@example.org");
    const log = await getDb().select().from(schema.auditLog);
    expect(log.map((e) => e.action)).toEqual(expect.arrayContaining(["student.create", "student.reset-code", "user.deactivate", "teacher.invite"]));
    const text = JSON.stringify(log);
    for (const secret of [s.loginCode, inv.token, "Maja", "ny@example.org"]) expect(text).not.toContain(secret);
  });
});

describe("den sista läraren skyddas", () => {
  it("enda läraren kan inte avaktiveras, raderas eller göras till elev", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const other = await makeTeacher(g, { twoFactor: false }); // väntande lärare räknas inte som användbar
    await expect(deactivateUser(actor(other.userId, g), t.userId)).rejects.toMatchObject({ code: "last-teacher" });
    await expect(changeRole(actor(other.userId, g), t.userId, "student")).rejects.toMatchObject({ code: "last-teacher" });
    await expect(deleteMember(actor(other.userId, g), t.userId)).rejects.toMatchObject({ code: "last-teacher" });
    expect((await getDb().select().from(schema.user).where(eq(schema.user.id, t.userId)))[0].deactivatedAt).toBeNull();
  });

  it("med två användbara lärare kan en tas bort men aldrig båda, även vid samtidiga anrop", async () => {
    for (let round = 0; round < 5; round++) {
      await resetDb();
      const g = await makeGroup();
      const a = await makeTeacher(g);
      const b = await makeTeacher(g);
      const ops: Promise<unknown>[] = [
        deactivateUser(actor(a.userId, g), b.userId),
        deactivateUser(actor(b.userId, g), a.userId),
        changeRole(actor(a.userId, g), b.userId, "student"),
        changeRole(actor(b.userId, g), a.userId, "student"),
        deleteMember(actor(a.userId, g), b.userId),
      ];
      const res = await Promise.allSettled(ops);
      const left = await getDb().execute(sql`
        SELECT count(*)::int AS n FROM memberships m JOIN "user" u ON u.id = m.user_id
        WHERE m.group_id = ${g} AND m.role = 'teacher' AND u.deactivated_at IS NULL AND u.two_factor_enabled = true`);
      expect(Number((left.rows[0] as { n: number }).n), `rond ${round}`).toBeGreaterThanOrEqual(1);
      expect(res.filter((r) => r.status === "rejected" && r.reason instanceof AdminError && r.reason.code === "last-teacher").length).toBeGreaterThanOrEqual(1);
    }
  });

  it("samtidiga rolländringar via HTTP lämnar alltid en lärare kvar", async () => {
    const g = await makeGroup();
    const a = await makeTeacher(g);
    const b = await makeTeacher(g);
    const la = await signInTeacher(a.email);
    const lb = await signInTeacher(b.email);
    await Promise.all([
      call(memberPOST, "/x", { method: "POST", cookie: la.cookie, body: { role: "student", password: a.password }, params: { id: b.userId, action: "roll" } }),
      call(memberPOST, "/x", { method: "POST", cookie: lb.cookie, body: { role: "student", password: b.password }, params: { id: a.userId, action: "roll" } }),
    ]);
    const teachers = await getDb().select().from(schema.memberships).where(eq(schema.memberships.role, "teacher"));
    expect(teachers.length).toBe(1);
  });

  it("rolländring elev -> lärare kräver inloggningsnamn och ger aktiveringsflöde utan adminåtkomst", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const s = await createStudent(actor(t.userId, g), "Maja");
    await expect(changeRole(actor(t.userId, g), s.userId, "teacher")).rejects.toMatchObject({ code: "invalid" });
    const r = await changeRole(actor(t.userId, g), s.userId, "teacher", { loginEmail: "maja.lararen@example.org" });
    expect(r.invitation?.token).toBeTruthy();
    await activateTeacher(r.invitation!.token, "Majas-nya-losenord-1");
    const login = await signInTeacher("maja.lararen@example.org", "Majas-nya-losenord-1");
    expect(login.res.status).toBe(200);
    const { GET: overview } = await import("@/app/api/lararen/oversikt/route");
    expect((await call(overview, "/x", { cookie: login.cookie })).status).toBe(403);
  });

  it("lärare -> elev ger ny kod och elev-inloggning", async () => {
    const g = await makeGroup();
    const a = await makeTeacher(g);
    const b = await makeTeacher(g);
    const r = await changeRole(actor(a.userId, g), b.userId, "student");
    expect(r.loginCode).toHaveLength(14);
    expect((await signInStudent(r.username!, r.loginCode!)).res.status).toBe(200);
    expect((await signInTeacher(b.email)).res.status).not.toBe(200);
  });

  it("ny lärare utan slutförd tvåfaktor hindrar inte skyddet (väntande lärare räknas inte som användbar)", async () => {
    const g = await makeGroup();
    const a = await makeTeacher(g);
    const inv = await inviteTeacher(actor(a.userId, g), "Ny", "ny@example.org");
    await activateTeacher(inv.token, "Nytt-starkt-losenord-1");
    // Den inbjudna har ännu inte registrerat tvåfaktor: a är fortfarande den enda användbara
    await expect(deactivateUser(actor(inv.userId, g), a.userId)).rejects.toMatchObject({ code: "last-teacher" });
  });
});

describe("operatörens engångskommando och återställning", () => {
  it("skapar första läraren utan admin före tvåfaktor, och är säkert att köra igen", async () => {
    await getDb().execute(sql`TRUNCATE groups CASCADE`);
    const first = await bootstrapFirstTeacher({ email: "per.a.bjorkman@gmail.com", password: "Forsta-losenordet-12", displayName: "Per" });
    expect(first.status).toBe("created");
    const u = (await getDb().select().from(schema.user).where(eq(schema.user.email, "per.a.bjorkman@gmail.com")))[0];
    expect(u.twoFactorEnabled).toBe(false);
    const hashBefore = (await getDb().select().from(schema.account).where(eq(schema.account.userId, u.id)))[0].password;
    const again = await bootstrapFirstTeacher({ email: "per.a.bjorkman@gmail.com", password: "Annat-losenord-99", displayName: "Annat" });
    expect(again.status).toBe("exists");
    const hashAfter = (await getDb().select().from(schema.account).where(eq(schema.account.userId, u.id)))[0].password;
    expect(hashAfter).toBe(hashBefore);
    expect((await getDb().select().from(schema.groups))).toHaveLength(1);
    expect((await getDb().select().from(schema.memberships))).toHaveLength(1);
    // Kan logga in med originallösenordet men har ingen adminåtkomst (tvåfaktor saknas)
    const login = await signInTeacher("per.a.bjorkman@gmail.com", "Forsta-losenordet-12");
    expect(login.res.status).toBe(200);
    const { GET: overview } = await import("@/app/api/lararen/oversikt/route");
    expect((await call(overview, "/x", { cookie: login.cookie })).status).toBe(403);
  });

  it("samtidiga körningar skapar exakt ett konto", async () => {
    await getDb().execute(sql`TRUNCATE groups CASCADE`);
    const res = await Promise.all(Array.from({ length: 4 }, () => bootstrapFirstTeacher({ email: "per.a.bjorkman@gmail.com", password: "Forsta-losenordet-12" })));
    expect(res.filter((r) => r.status === "created")).toHaveLength(1);
    expect((await getDb().select().from(schema.user))).toHaveLength(1);
  });

  it("ingen automatisk befordran: ett befintligt konto (t.ex. elev) med samma adress ändras inte, och ytterligare lärare kräver uttrycklig flagga", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g, { email: "annan@example.org" });
    // en elev kan inte ha e-post, men ett befintligt icke-lärarkonto med adressen får inte befordras
    await getDb().insert(schema.user).values({ id: "u-existing-1", name: "X", email: "per.a.bjorkman@gmail.com", emailVerified: false });
    expect((await bootstrapFirstTeacher({ email: "per.a.bjorkman@gmail.com", password: "Forsta-losenordet-12" })).status).toBe("exists");
    expect(await getDb().select().from(schema.memberships).where(eq(schema.memberships.userId, "u-existing-1"))).toHaveLength(0);
    // Gruppen har redan en lärare: ny bootstrap vägras utan flagga
    const refused = await bootstrapFirstTeacher({ email: "ny@example.org", password: "Forsta-losenordet-12", groupName: "Japanresan 2027" });
    expect(refused.status).toBe("refused");
    expect(t.userId).toBeTruthy();
  });

  it("operatörsåterställning: nytt lösenord + borttagen tvåfaktor, sessioner avslutas, loggas utan hemligheter", async () => {
    const g = await makeGroup();
    const t = await makeTeacher(g);
    const l = await signInTeacher(t.email);
    const res = await operatorResetTeacher({ email: t.email, newPassword: "Nytt-operatorlosenord-1", reset2fa: true });
    expect(res.status).toBe("done");
    const { GET: meGET } = await import("@/app/api/me/route");
    expect((await call(meGET, "/x", { cookie: l.cookie })).data).toEqual({ user: null });
    const again = await signInTeacher(t.email, "Nytt-operatorlosenord-1");
    expect(again.res.status).toBe(200);
    expect((await call(meGET, "/x", { cookie: again.cookie })).data).toMatchObject({ user: { adminAccess: false, enrollmentRequired: true } });
    const log = JSON.stringify(await getDb().select().from(schema.auditLog));
    expect(log).toContain("operator.reset-2fa");
    expect(log).not.toContain("Nytt-operatorlosenord-1");
    expect((await operatorResetTeacher({ email: "finns-inte@example.org", reset2fa: true })).status).toBe("not-found");
  });
});
