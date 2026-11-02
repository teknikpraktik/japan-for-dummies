import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import { audit } from "./audit";
import { hashPassword, isInternalEmail } from "./accounts";
import { newId } from "./ids";

export const DEFAULT_GROUP_NAME = "Japanresan 2027";

export type BootstrapResult = { status: "created" | "exists" | "refused"; reason?: string };

/**
 * Engångskommando (körs av en operatör med databasåtkomst, aldrig via HTTP).
 * - Skapar gruppen om den saknas.
 * - Skapar läraren om e-postadressen är ny. Läraren kan logga in direkt; tvåfaktor är valfritt.
 * - Om kontot redan finns: ändrar ingenting (inget nytt lösenord, ingen rolländring, ingen befordran).
 * - Vägrar skapa ytterligare en lärare i en grupp som redan har lärare, om inte allowAdditional anges.
 */
export async function bootstrapFirstTeacher(opts: {
  email: string;
  password: string;
  displayName?: string;
  groupName?: string;
  allowAdditional?: boolean;
}): Promise<BootstrapResult> {
  const email = opts.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || isInternalEmail(email)) return { status: "refused", reason: "Ogiltig e-postadress." };
  const groupName = opts.groupName ?? DEFAULT_GROUP_NAME;
  const db = getDb();

  const existing = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, email)).limit(1);
  if (existing[0]) return { status: "exists" };
  if (opts.password.length < 12 || opts.password.length > 128) return { status: "refused", reason: "Lösenordet ska vara 12–128 tecken." };

  const hash = await hashPassword(opts.password);
  try {
    return await db.transaction(async (tx) => {
      let g = (await tx.select().from(schema.groups).where(eq(schema.groups.name, groupName)).limit(1))[0];
      if (!g) {
        const id = newId();
        await tx.insert(schema.groups).values({ id, name: groupName }).onConflictDoNothing();
        g = (await tx.select().from(schema.groups).where(eq(schema.groups.name, groupName)).limit(1))[0]!;
      }
      await tx.execute(sql`SELECT id FROM groups WHERE id = ${g.id} FOR UPDATE`);
      const teachers = await tx.execute(sql`SELECT count(*)::int AS n FROM memberships WHERE group_id = ${g.id} AND role = 'teacher'`);
      if (Number((teachers.rows[0] as { n: number }).n) > 0 && !opts.allowAdditional) {
        return { status: "refused" as const, reason: "Gruppen har redan lärare. Använd lärarnas administration, eller --allow-additional vid nödåterställning." };
      }
      const userId = newId();
      await tx.insert(schema.user).values({ id: userId, name: opts.displayName?.trim() || "Lärare", email, emailVerified: false, twoFactorEnabled: false });
      await tx.insert(schema.account).values({ id: newId(), accountId: userId, providerId: "credential", userId, password: hash });
      await tx.insert(schema.memberships).values({ id: newId(), groupId: g.id, userId, role: "teacher" });
      await audit(tx, { actorId: null, groupId: g.id, action: "operator.bootstrap-teacher", targetUserId: userId });
      return { status: "created" as const };
    });
  } catch (e) {
    const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    if (code === "23505") return { status: "exists" }; // samtidigt anrop skapade kontot först
    throw e;
  }
}

/** Operatörsåterställning (kräver databasåtkomst). Ingen bakdörr: inget HTTP-anrop kan göra detta. */
export async function operatorResetTeacher(opts: { email: string; newPassword?: string; reset2fa: boolean }): Promise<{ status: "done" | "not-found" | "not-teacher" }> {
  const email = opts.email.trim().toLowerCase();
  const db = getDb();
  const hash = opts.newPassword ? await hashPassword(opts.newPassword) : undefined;
  return db.transaction(async (tx) => {
    const u = (await tx.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, email)).limit(1))[0];
    if (!u) return { status: "not-found" as const };
    const m = (await tx.select().from(schema.memberships).where(eq(schema.memberships.userId, u.id)).limit(1))[0];
    if (!m || m.role !== "teacher") return { status: "not-teacher" as const };
    if (hash) {
      await tx.update(schema.account).set({ password: hash, updatedAt: new Date() }).where(eq(schema.account.userId, u.id));
      await tx.update(schema.user).set({ deactivatedAt: null }).where(eq(schema.user.id, u.id));
      await audit(tx, { actorId: null, groupId: m.groupId, action: "operator.reset-password", targetUserId: u.id });
    }
    if (opts.reset2fa) {
      await tx.delete(schema.twoFactor).where(eq(schema.twoFactor.userId, u.id));
      await tx.update(schema.user).set({ twoFactorEnabled: false }).where(eq(schema.user.id, u.id));
      await audit(tx, { actorId: null, groupId: m.groupId, action: "operator.reset-2fa", targetUserId: u.id });
    }
    await tx.delete(schema.session).where(eq(schema.session.userId, u.id));
    return { status: "done" as const };
  });
}
