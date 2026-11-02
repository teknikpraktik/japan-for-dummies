import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { symmetricEncrypt } from "better-auth/crypto";
import { getAuth, createAuth } from "@/server/auth";
import { getDb, schema } from "@/server/db";
import { hashPassword } from "@/server/services/accounts";
import { newId } from "@/server/services/ids";

export const ORIGIN = "http://localhost:3000";
export const TEACHER_PASSWORD = "Lararens-testlosenord-1";
export const TOTP_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";

/** RFC 6238 (SHA-1, 30 s, 6 siffror). Endast testhjälpare. */
export function totp(secretBase32: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secretBase32.replace(/=+$/, "")) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const bytes = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = createHmac("sha1", bytes).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

export async function resetDb() {
  await getDb().execute(sql`TRUNCATE "user", groups, rate_limit, verification, audit_log, login_throttle RESTART IDENTITY CASCADE`);
}

export async function makeGroup(name = "Japanresan 2027") {
  const id = newId();
  await getDb().insert(schema.groups).values({ id, name });
  return id;
}

export async function makeTeacher(groupId: string, opts: { email?: string; twoFactor?: boolean; name?: string; password?: string } = {}) {
  const email = opts.email ?? `larare-${newId().slice(0, 8)}@example.test`;
  const userId = newId();
  const db = getDb();
  await db.insert(schema.user).values({ id: userId, name: opts.name ?? "Lärare", email, emailVerified: false, twoFactorEnabled: opts.twoFactor ?? true });
  await db.insert(schema.account).values({ id: newId(), accountId: userId, providerId: "credential", userId, password: await hashPassword(opts.password ?? TEACHER_PASSWORD) });
  await db.insert(schema.memberships).values({ id: newId(), groupId, userId, role: "teacher" });
  if (opts.twoFactor ?? true) {
    const ctx = await getAuth().$context;
    await db.insert(schema.twoFactor).values({
      id: newId(),
      userId,
      secret: await symmetricEncrypt({ key: ctx.secretConfig, data: `base32:${TOTP_SECRET}` }),
      backupCodes: await symmetricEncrypt({ key: ctx.secretConfig, data: JSON.stringify([]) }),
      verified: true,
    });
  }
  return { userId, email, password: opts.password ?? TEACHER_PASSWORD };
}

function cookiesFrom(res: Response, prev = ""): string {
  const jar = new Map<string, string>();
  for (const c of prev.split("; ").filter(Boolean)) jar.set(c.split("=")[0], c);
  const set = res.headers.getSetCookie?.() ?? [];
  for (const sc of set) {
    const pair = sc.split(";")[0];
    const name = pair.split("=")[0];
    if (/;\s*max-age=0/i.test(sc) || pair.endsWith("=")) jar.delete(name);
    else jar.set(name, pair);
  }
  return [...jar.values()].join("; ");
}

let ipCounter = 10;
export const nextIp = () => `203.0.113.${ipCounter++ % 250}`;

export async function authPost(path: string, body: unknown, cookie = "", auth = getAuth(), ip = nextIp()) {
  const res = await auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, cookie, "x-forwarded-for": ip, "user-agent": "vitest" }, body: JSON.stringify(body) }),
  );
  return { res, cookie: cookiesFrom(res, cookie), body: (await res.json().catch(() => null)) as Record<string, unknown> | null };
}

export async function signInStudent(username: string, code: string, ip?: string) {
  return authPost("/sign-in/username", { username, password: code }, "", getAuth(), ip);
}

export async function signInTeacher(email: string, password = TEACHER_PASSWORD, withTotp = true) {
  const first = await authPost("/sign-in/email", { email, password });
  if (first.res.status !== 200) return { ...first, cookie: "" };
  if (first.body && first.body.twoFactorRedirect) {
    if (!withTotp) return { ...first, cookie: first.cookie, pendingTwoFactor: true };
    const second = await authPost("/two-factor/verify-totp", { code: totp(TOTP_SECRET) }, first.cookie);
    return { ...second, pendingTwoFactor: false };
  }
  return { ...first, pendingTwoFactor: false };
}

/** Anropar en route-handler som HTTP-anrop (samma väg som Next.js). */
export async function call(
  handler: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>,
  path: string,
  opts: { method?: string; cookie?: string; body?: unknown; origin?: string | null; params?: Record<string, string>; contentType?: string } = {},
) {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { cookie: opts.cookie ?? "" };
  if (opts.origin !== null) headers.origin = opts.origin ?? ORIGIN;
  if (method !== "GET") headers["content-type"] = opts.contentType ?? "application/json";
  const res = await handler(new Request(`${ORIGIN}${path}`, { method, headers, body: opts.body === undefined || method === "GET" ? undefined : JSON.stringify(opts.body) }), { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.text();
  let data: Record<string, unknown> | null = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* inte JSON */
  }
  return { status: res.status, data, headers: res.headers };
}

export { createAuth };
