import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "../db";

export interface MemberRow {
  userId: string;
  displayName: string;
  role: "student" | "teacher";
  /** Elevens användarnamn (pseudonym). Lärares inloggningsnamn är e-postadressen. */
  loginName: string | null;
  active: boolean;
  /** Lärare som ännu inte aktiverat sig (inte satt eget lösenord). */
  setupPending: boolean;
  createdAt: string;
}

export async function listMembers(groupId: string): Promise<MemberRow[]> {
  const rows = await getDb()
    .select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      username: schema.user.username,
      deactivatedAt: schema.user.deactivatedAt,
      pending: sql<boolean>`EXISTS (SELECT 1 FROM teacher_activations a WHERE a.user_id = ${schema.user.id} AND a.used_at IS NULL)`,
      role: schema.memberships.role,
      createdAt: schema.user.createdAt,
    })
    .from(schema.memberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.memberships.userId))
    .where(eq(schema.memberships.groupId, groupId))
    .orderBy(asc(schema.memberships.role), asc(schema.user.name), asc(schema.user.createdAt));
  return rows.map((r) => ({
    userId: r.id,
    displayName: r.name,
    role: r.role as "student" | "teacher",
    loginName: r.role === "student" ? r.username : r.email,
    active: !r.deactivatedAt,
    setupPending: r.role === "teacher" && Boolean(r.pending),
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Bara medlemmar i den egna gruppen får hanteras. Används av skyddade ändringar för att avvisa andra gruppers konton. */
export async function isMemberOfGroup(groupId: string, userId: string): Promise<boolean> {
  const r = await getDb()
    .select({ id: schema.memberships.id })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.groupId, groupId), eq(schema.memberships.userId, userId)))
    .limit(1);
  return r.length > 0;
}

export async function pendingActivations(groupId: string) {
  return getDb()
    .select({ userId: schema.teacherActivations.userId, expiresAt: schema.teacherActivations.expiresAt })
    .from(schema.teacherActivations)
    .where(and(eq(schema.teacherActivations.groupId, groupId), isNull(schema.teacherActivations.usedAt), sql`${schema.teacherActivations.expiresAt} > now()`));
}
