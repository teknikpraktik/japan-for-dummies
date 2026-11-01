import { eq } from "drizzle-orm";
import { symmetricEncrypt } from "better-auth/crypto";
import { getAuth } from "../auth";
import { getDb, schema } from "../db";
import { hashPassword } from "./accounts";
import { DEFAULT_GROUP_NAME } from "./bootstrap";
import { newId } from "./ids";

/** Dokumenterade, OFFENTLIGA och SYNTETISKA uppgifter för utveckling, test och förhandsvisning. Aldrig för produktion. */
export const SYNTHETIC = {
  teacherEmail: "larare.syntetisk@example.test",
  teacherPassword: "Syntetiskt-losenord-1",
  /** Base32-hemlighet för TOTP (syntetisk). */
  teacherTotpSecret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
  studentCount: 16,
  studentUsername: (n: number) => `syn_elev_${String(n).padStart(2, "0")}`,
  studentCode: (n: number) => `SYNTETISKELEV${String(n).padStart(2, "0")}`,
  studentName: (n: number) => (n <= 2 ? "Alex" : `Elev ${n}`),
};

export async function seedSynthetic(): Promise<{ groupId: string }> {
  const target = process.env.DB_TARGET;
  if (target === "production") throw new Error("Syntetiska elever får aldrig skapas i produktion.");
  const db = getDb();
  let g = (await db.select().from(schema.groups).where(eq(schema.groups.name, DEFAULT_GROUP_NAME)).limit(1))[0];
  if (!g) {
    await db.insert(schema.groups).values({ id: newId(), name: DEFAULT_GROUP_NAME }).onConflictDoNothing();
    g = (await db.select().from(schema.groups).where(eq(schema.groups.name, DEFAULT_GROUP_NAME)).limit(1))[0]!;
  }
  const ctx = await getAuth().$context;
  const hasTeacher = (await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, SYNTHETIC.teacherEmail)).limit(1))[0];
  if (!hasTeacher) {
    const userId = newId();
    await db.insert(schema.user).values({ id: userId, name: "Syntetisk lärare", email: SYNTHETIC.teacherEmail, emailVerified: false, twoFactorEnabled: true });
    await db.insert(schema.account).values({ id: newId(), accountId: userId, providerId: "credential", userId, password: await hashPassword(SYNTHETIC.teacherPassword) });
    await db.insert(schema.memberships).values({ id: newId(), groupId: g.id, userId, role: "teacher" });
    const secret = await symmetricEncrypt({ key: ctx.secretConfig, data: `base32:${SYNTHETIC.teacherTotpSecret}` });
    const codes = await symmetricEncrypt({ key: ctx.secretConfig, data: JSON.stringify([]) });
    await db.insert(schema.twoFactor).values({ id: newId(), userId, secret, backupCodes: codes, verified: true });
  }
  for (let n = 1; n <= SYNTHETIC.studentCount; n++) {
    const username = SYNTHETIC.studentUsername(n);
    const exists = (await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.username, username)).limit(1))[0];
    if (exists) continue;
    const userId = newId();
    await db.insert(schema.user).values({ id: userId, name: SYNTHETIC.studentName(n), email: `s-${userId}@elev.invalid`, emailVerified: false, username, displayUsername: username, twoFactorEnabled: false });
    await db.insert(schema.account).values({ id: newId(), accountId: userId, providerId: "credential", userId, password: await hashPassword(SYNTHETIC.studentCode(n)) });
    await db.insert(schema.memberships).values({ id: newId(), groupId: g.id, userId, role: "student" });
  }
  return { groupId: g.id };
}
