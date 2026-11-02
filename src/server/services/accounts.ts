import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { getAuth } from "../auth";
import { getDb, schema, type Tx } from "../db";
import { audit } from "./audit";
import { formatLoginCode, generateLoginCode, generateToken, generateUsername, newId } from "./ids";

export class AdminError extends Error {
  constructor(public code: "not-found" | "last-teacher" | "invalid" | "conflict" | "forbidden", message: string) {
    super(message);
  }
}

export type Role = "student" | "teacher";
export const ACTIVATION_TTL_MS = 72 * 60 * 60 * 1000;

/** Intern, aldrig-utskickad e-postadress för elever (reserverad .invalid-domän). Visas inte som verklig e-post. */
export function internalStudentEmail(userId: string): string {
  return `s-${userId}@elev.invalid`;
}
export const isInternalEmail = (email: string) => email.toLowerCase().endsWith(".invalid");

/** Hashar med Better Auths egen funktion (scrypt). Ingen egen kryptografi. */
export async function hashPassword(plain: string): Promise<string> {
  const ctx = await getAuth().$context;
  return ctx.password.hash(plain);
}
export async function verifyPasswordHash(hash: string, plain: string): Promise<boolean> {
  const ctx = await getAuth().$context;
  return ctx.password.verify({ hash, password: plain });
}
/** Ett lösenord som ingen känner till (för konton som inte kan logga in förrän de aktiveras/återställs). */
async function unusablePasswordHash(): Promise<string> {
  return hashPassword(randomBytes(48).toString("base64url"));
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Låser gruppens rad så att administrativa ändringar som påverkar lärarbehörighet körs en i taget. */
async function lockGroup(tx: Tx, groupId: string): Promise<void> {
  const r = await tx.execute(sql`SELECT id FROM groups WHERE id = ${groupId} FOR UPDATE`);
  if (r.rows.length === 0) throw new AdminError("not-found", "Gruppen finns inte.");
}

async function getMember(tx: Tx, groupId: string, userId: string) {
  const rows = await tx
    .select({ role: schema.memberships.role, deactivatedAt: schema.user.deactivatedAt, twoFactorEnabled: schema.user.twoFactorEnabled, name: schema.user.name, email: schema.user.email, username: schema.user.username })
    .from(schema.memberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.memberships.userId))
    .where(and(eq(schema.memberships.groupId, groupId), eq(schema.memberships.userId, userId)))
    .limit(1);
  return rows[0];
}

/** Antal andra aktiva, aktiverade lärare (de som faktiskt kan logga in och administrera). Inbjudna som inte satt lösenord räknas inte. */
async function otherUsableTeachers(tx: Tx, groupId: string, excludeUserId: string): Promise<number> {
  const r = await tx.execute(sql`
    SELECT count(*)::int AS n FROM memberships m JOIN "user" u ON u.id = m.user_id
    WHERE m.group_id = ${groupId} AND m.role = 'teacher' AND u.deactivated_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM teacher_activations a WHERE a.user_id = u.id AND a.used_at IS NULL)
      AND u.id <> ${excludeUserId}`);
  return Number((r.rows[0] as { n: number }).n);
}

function cleanName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 40) throw new AdminError("invalid", "Förnamn eller alias ska vara 1–40 tecken.");
  if (/[<>]/.test(name)) throw new AdminError("invalid", "Namnet innehåller otillåtna tecken.");
  return name;
}

async function revokeSessions(tx: Tx, userId: string) {
  await tx.delete(schema.session).where(eq(schema.session.userId, userId));
}

/* ---------------------------------------------------------------- Elever */

export interface NewStudent {
  userId: string;
  displayName: string;
  username: string;
  /** Visas endast en gång. Lagras aldrig i klartext. */
  loginCode: string;
  loginCodeFormatted: string;
}

export async function createStudent(actor: { userId: string; groupId: string }, rawName: string): Promise<NewStudent> {
  const displayName = cleanName(rawName);
  const code = generateLoginCode();
  const hash = await hashPassword(code);
  const db = getDb();
  for (let attempt = 0; attempt < 5; attempt++) {
    const userId = newId();
    const username = generateUsername();
    try {
      await db.transaction(async (tx) => {
        await lockGroup(tx, actor.groupId);
        await tx.insert(schema.user).values({ id: userId, name: displayName, email: internalStudentEmail(userId), emailVerified: false, username, displayUsername: username, twoFactorEnabled: false });
        await tx.insert(schema.account).values({ id: newId(), accountId: userId, providerId: "credential", userId, password: hash });
        await tx.insert(schema.memberships).values({ id: newId(), groupId: actor.groupId, userId, role: "student", createdBy: actor.userId });
        await audit(tx, { actorId: actor.userId, groupId: actor.groupId, action: "student.create", targetUserId: userId });
      });
      return { userId, displayName, username, loginCode: code, loginCodeFormatted: formatLoginCode(code) };
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 4) continue; // slumpat användarnamn krockade: försök igen
      throw e;
    }
  }
  throw new AdminError("conflict", "Kunde inte skapa ett unikt användarnamn.");
}

function isUniqueViolation(e: unknown): boolean {
  const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
  return code === "23505";
}

/** Ny elevkod: den gamla blir ogiltig direkt (lösenordshashen ersätts) och alla sessioner återkallas. */
export async function resetStudentCode(actor: { userId: string; groupId: string }, targetId: string) {
  const code = generateLoginCode();
  const hash = await hashPassword(code);
  return getDb().transaction(async (tx) => {
    await lockGroup(tx, actor.groupId);
    const m = await getMember(tx, actor.groupId, targetId);
    if (!m || m.role !== "student") throw new AdminError("not-found", "Eleven finns inte i gruppen.");
    await tx.update(schema.account).set({ password: hash, updatedAt: new Date() }).where(and(eq(schema.account.userId, targetId), eq(schema.account.providerId, "credential")));
    // Ny kod innebär också att kontot är aktivt igen.
    await tx.update(schema.user).set({ deactivatedAt: null, updatedAt: new Date() }).where(eq(schema.user.id, targetId));
    await revokeSessions(tx, targetId);
    await tx.delete(schema.loginThrottle).where(eq(schema.loginThrottle.key, createHash("sha256").update(`login:${(m.username ?? "").toLowerCase()}`).digest("hex")));
    await audit(tx, { actorId: actor.userId, groupId: actor.groupId, action: "student.reset-code", targetUserId: targetId });
    return { username: m.username ?? "", displayName: m.name, loginCode: code, loginCodeFormatted: formatLoginCode(code) };
  });
}

/* ------------------------------------------------- Avaktivering / aktivering */

export async function deactivateUser(actor: { userId: string; groupId: string }, targetId: string): Promise<void> {
  const unusable = await unusablePasswordHash();
  await getDb().transaction(async (tx) => {
    await lockGroup(tx, actor.groupId);
    const m = await getMember(tx, actor.groupId, targetId);
    if (!m) throw new AdminError("not-found", "Kontot finns inte i gruppen.");
    if (m.deactivatedAt) return; // idempotent
    if (m.role === "teacher" && (await otherUsableTeachers(tx, actor.groupId, targetId)) < 1) {
      throw new AdminError("last-teacher", "Det går inte att avaktivera den sista aktiva läraren.");
    }
    await tx.update(schema.user).set({ deactivatedAt: new Date(), updatedAt: new Date() }).where(eq(schema.user.id, targetId));
    // Gör även inloggningsuppgiften obrukbar så att försök ger samma generella fel som ett okänt konto.
    await tx.update(schema.account).set({ password: unusable }).where(and(eq(schema.account.userId, targetId), eq(schema.account.providerId, "credential")));
    await revokeSessions(tx, targetId);
    await audit(tx, { actorId: actor.userId, groupId: actor.groupId, action: "user.deactivate", targetUserId: targetId });
  });
}

/** Återaktiverar en elev (med ny kod). Lärare återaktiveras via nytt aktiveringsflöde (reactivateTeacher). */
export async function reactivateStudent(actor: { userId: string; groupId: string }, targetId: string) {
  const res = await resetStudentCode(actor, targetId);
  await audit(getDb(), { actorId: actor.userId, groupId: actor.groupId, action: "user.reactivate", targetUserId: targetId });
  return res;
}

/* ------------------------------------------------------------------ Lärare */

export interface Invitation {
  userId: string;
  /** Visas en gång. Endast hash lagras. Länken är /aktivera/<token>. */
  token: string;
  expiresAt: Date;
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export async function inviteTeacher(actor: { userId: string; groupId: string }, rawName: string, loginEmail: string): Promise<Invitation> {
  const displayName = cleanName(rawName);
  const email = loginEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || isInternalEmail(email) || email.length > 120) throw new AdminError("invalid", "Ange en giltig adress som inloggningsnamn.");
  const unusable = await unusablePasswordHash();
  const token = generateToken();
  const userId = newId();
  const expiresAt = new Date(Date.now() + ACTIVATION_TTL_MS);
  await getDb().transaction(async (tx) => {
    await lockGroup(tx, actor.groupId);
    const exists = await tx.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, email)).limit(1);
    if (exists[0]) throw new AdminError("conflict", "Det finns redan ett konto med det inloggningsnamnet.");
    await tx.insert(schema.user).values({ id: userId, name: displayName, email, emailVerified: false, twoFactorEnabled: false });
    await tx.insert(schema.account).values({ id: newId(), accountId: userId, providerId: "credential", userId, password: unusable });
    await tx.insert(schema.memberships).values({ id: newId(), groupId: actor.groupId, userId, role: "teacher", createdBy: actor.userId });
    await tx.insert(schema.teacherActivations).values({ id: newId(), userId, groupId: actor.groupId, tokenHash: hashToken(token), createdBy: actor.userId, expiresAt });
    await audit(tx, { actorId: actor.userId, groupId: actor.groupId, action: "teacher.invite", targetUserId: userId });
  });
  return { userId, token, expiresAt };
}

/** Ny aktiveringslänk för en lärare som ännu inte aktiverat sig eller som återaktiveras. Äldre länkar blir ogiltiga. */
export async function reissueTeacherActivation(actor: { userId: string; groupId: string }, targetId: string): Promise<Invitation> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + ACTIVATION_TTL_MS);
  const unusable = await unusablePasswordHash();
  await getDb().transaction(async (tx) => {
    await lockGroup(tx, actor.groupId);
    const m = await getMember(tx, actor.groupId, targetId);
    if (!m || m.role !== "teacher") throw new AdminError("not-found", "Läraren finns inte i gruppen.");
    // Ett aktivt, aktiverat konto ska inte kunna få sitt lösenord ersatt utan avaktivering: använd avaktivera + återaktivera.
    const pending = await tx.select({ id: schema.teacherActivations.id }).from(schema.teacherActivations).where(and(eq(schema.teacherActivations.userId, targetId), isNull(schema.teacherActivations.usedAt))).limit(1);
    if (!m.deactivatedAt && pending.length === 0) throw new AdminError("conflict", "Läraren är redan aktiverad. Avaktivera kontot först om åtkomsten ska återställas.");
    await tx.update(schema.teacherActivations).set({ usedAt: new Date() }).where(and(eq(schema.teacherActivations.userId, targetId), isNull(schema.teacherActivations.usedAt)));
    await tx.insert(schema.teacherActivations).values({ id: newId(), userId: targetId, groupId: actor.groupId, tokenHash: hashToken(token), createdBy: actor.userId, expiresAt });
    await tx.update(schema.account).set({ password: unusable }).where(and(eq(schema.account.userId, targetId), eq(schema.account.providerId, "credential")));
    await tx.update(schema.user).set({ deactivatedAt: null, twoFactorEnabled: false, updatedAt: new Date() }).where(eq(schema.user.id, targetId));
    await tx.delete(schema.twoFactor).where(eq(schema.twoFactor.userId, targetId));
    await revokeSessions(tx, targetId);
    await audit(tx, { actorId: actor.userId, groupId: actor.groupId, action: "user.reactivate", targetUserId: targetId });
  });
  return { userId: targetId, token, expiresAt };
}

export async function checkActivationToken(token: string): Promise<{ valid: boolean; displayName?: string; loginName?: string }> {
  const rows = await getDb()
    .select({ usedAt: schema.teacherActivations.usedAt, expiresAt: schema.teacherActivations.expiresAt, name: schema.user.name, email: schema.user.email, deactivated: schema.user.deactivatedAt })
    .from(schema.teacherActivations)
    .innerJoin(schema.user, eq(schema.user.id, schema.teacherActivations.userId))
    .where(eq(schema.teacherActivations.tokenHash, hashToken(token)))
    .limit(1);
  const r = rows[0];
  if (!r || r.usedAt || r.expiresAt.getTime() < Date.now() || r.deactivated) return { valid: false };
  return { valid: true, displayName: r.name, loginName: r.email };
}

/** Läraren sätter eget lösenord via engångslänk. Efter detta kan läraren logga in. */
export async function activateTeacher(token: string, newPassword: string): Promise<{ loginName: string }> {
  if (newPassword.length < 12 || newPassword.length > 128) throw new AdminError("invalid", "Lösenordet ska vara 12–128 tecken.");
  const hash = await hashPassword(newPassword);
  return getDb().transaction(async (tx) => {
    // Förbruka token atomiskt: bara en av flera samtidiga anrop lyckas.
    const consumed = await tx
      .update(schema.teacherActivations)
      .set({ usedAt: new Date() })
      .where(and(eq(schema.teacherActivations.tokenHash, hashToken(token)), isNull(schema.teacherActivations.usedAt), sql`${schema.teacherActivations.expiresAt} > now()`))
      .returning({ userId: schema.teacherActivations.userId, groupId: schema.teacherActivations.groupId });
    const c = consumed[0];
    if (!c) throw new AdminError("invalid", "Länken är ogiltig eller har gått ut.");
    const u = await tx.select({ email: schema.user.email, deactivatedAt: schema.user.deactivatedAt }).from(schema.user).where(eq(schema.user.id, c.userId)).limit(1);
    if (!u[0] || u[0].deactivatedAt) throw new AdminError("invalid", "Länken är ogiltig eller har gått ut.");
    await tx.update(schema.account).set({ password: hash, updatedAt: new Date() }).where(and(eq(schema.account.userId, c.userId), eq(schema.account.providerId, "credential")));
    await revokeSessions(tx, c.userId);
    await audit(tx, { actorId: c.userId, groupId: c.groupId, action: "teacher.activate", targetUserId: c.userId });
    return { loginName: u[0].email };
  });
}

/* ------------------------------------------------------------- Rolländring */

/**
 * Ändrar roll inom gruppen. Lärare -> elev ger ny kod (användarnamn skapas vid behov, e-post blir intern).
 * Elev -> lärare kräver ett inloggningsnamn och ger ett aktiveringsflöde (eget lösenord).
 */
export async function changeRole(
  actor: { userId: string; groupId: string },
  targetId: string,
  newRole: Role,
  opts: { loginEmail?: string } = {},
): Promise<{ loginCode?: string; loginCodeFormatted?: string; username?: string; invitation?: Invitation }> {
  const unusable = await unusablePasswordHash();
  let studentCode: string | undefined;
  let studentHash: string | undefined;
  if (newRole === "student") {
    studentCode = generateLoginCode();
    studentHash = await hashPassword(studentCode);
  }
  const token = generateToken();
  const email = opts.loginEmail?.trim().toLowerCase();
  return getDb().transaction(async (tx) => {
    await lockGroup(tx, actor.groupId);
    const m = await getMember(tx, actor.groupId, targetId);
    if (!m) throw new AdminError("not-found", "Kontot finns inte i gruppen.");
    if (m.role === newRole) return {};
    if (m.role === "teacher") {
      if ((await otherUsableTeachers(tx, actor.groupId, targetId)) < 1) throw new AdminError("last-teacher", "Det går inte att göra den sista aktiva läraren till elev.");
    }
    await tx.update(schema.memberships).set({ role: newRole }).where(and(eq(schema.memberships.groupId, actor.groupId), eq(schema.memberships.userId, targetId)));
    await revokeSessions(tx, targetId);
    let result: { loginCode?: string; loginCodeFormatted?: string; username?: string; invitation?: Invitation } = {};
    if (newRole === "student") {
      let username = m.username;
      if (!username) username = generateUsername();
      await tx.update(schema.user).set({ username, displayUsername: username, email: internalStudentEmail(targetId), twoFactorEnabled: false, updatedAt: new Date() }).where(eq(schema.user.id, targetId));
      await tx.delete(schema.twoFactor).where(eq(schema.twoFactor.userId, targetId));
      await tx.update(schema.account).set({ password: studentHash! }).where(and(eq(schema.account.userId, targetId), eq(schema.account.providerId, "credential")));
      result = { loginCode: studentCode!, loginCodeFormatted: formatLoginCode(studentCode!), username };
    } else {
      if (!email || !EMAIL_RE.test(email) || isInternalEmail(email)) throw new AdminError("invalid", "Ange en giltig adress som lärarens inloggningsnamn.");
      const dup = await tx.select({ id: schema.user.id }).from(schema.user).where(and(eq(schema.user.email, email), ne(schema.user.id, targetId))).limit(1);
      if (dup[0]) throw new AdminError("conflict", "Det finns redan ett konto med det inloggningsnamnet.");
      const expiresAt = new Date(Date.now() + ACTIVATION_TTL_MS);
      await tx.update(schema.user).set({ email, username: null, displayUsername: null, twoFactorEnabled: false, updatedAt: new Date() }).where(eq(schema.user.id, targetId));
      await tx.update(schema.account).set({ password: unusable }).where(and(eq(schema.account.userId, targetId), eq(schema.account.providerId, "credential")));
      await tx.insert(schema.teacherActivations).values({ id: newId(), userId: targetId, groupId: actor.groupId, tokenHash: hashToken(token), createdBy: actor.userId, expiresAt });
      result = { invitation: { userId: targetId, token, expiresAt } };
    }
    await audit(tx, { actorId: actor.userId, groupId: actor.groupId, action: "user.role-change", targetUserId: targetId, details: { from: m.role, to: newRole } });
    return result;
  });
}

/* ------------------------------------------------- Radering och export */

export async function deleteMember(actor: { userId: string; groupId: string }, targetId: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    await lockGroup(tx, actor.groupId);
    const m = await getMember(tx, actor.groupId, targetId);
    if (!m) throw new AdminError("not-found", "Kontot finns inte i gruppen.");
    if (m.role === "teacher" && (await otherUsableTeachers(tx, actor.groupId, targetId)) < 1) {
      throw new AdminError("last-teacher", "Det går inte att radera den sista aktiva läraren.");
    }
    if (targetId === actor.userId) throw new AdminError("forbidden", "Du kan inte radera ditt eget konto här.");
    // Raderar användaren; framsteg, konton, sessioner och medlemskap raderas via kaskad. Loggposten behåller bara pseudonymt ID.
    await audit(tx, { actorId: actor.userId, groupId: actor.groupId, action: "student.delete", targetUserId: targetId, details: { role: m.role } });
    await tx.delete(schema.user).where(eq(schema.user.id, targetId));
  });
}

export async function exportStudentData(actor: { userId: string; groupId: string }, targetId: string) {
  const db = getDb();
  const m = await db
    .select({ id: schema.user.id, name: schema.user.name, username: schema.user.username, createdAt: schema.user.createdAt, deactivatedAt: schema.user.deactivatedAt, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.memberships.userId))
    .where(and(eq(schema.memberships.groupId, actor.groupId), eq(schema.memberships.userId, targetId)))
    .limit(1);
  if (!m[0]) throw new AdminError("not-found", "Kontot finns inte i gruppen.");
  const rows = await db.select().from(schema.progress).where(eq(schema.progress.userId, targetId));
  const sync = await db.select().from(schema.syncState).where(eq(schema.syncState.userId, targetId)).limit(1);
  await audit(db, { actorId: actor.userId, groupId: actor.groupId, action: "student.export", targetUserId: targetId });
  return {
    exportedAt: new Date().toISOString(),
    note: "Utdrag av uppgifter som tjänsten lagrar centralt. Inloggningskoder lagras inte i läsbar form och kan inte exporteras.",
    account: { id: m[0].id, displayName: m[0].name, username: m[0].username, role: m[0].role, createdAt: m[0].createdAt, deactivatedAt: m[0].deactivatedAt },
    progress: rows.map((r) => ({ chapterId: r.chapterId, chapterVersion: r.chapterVersion, status: r.status, source: r.source, startedAt: r.startedAt, completedAt: r.completedAt, completedVersion: r.completedVersion })),
    lastSyncedAt: sync[0]?.lastSyncedAt ?? null,
  };
}
