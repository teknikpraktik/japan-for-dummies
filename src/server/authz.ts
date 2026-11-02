import { and, asc, eq } from "drizzle-orm";
import { getAuth } from "./auth";
import { getDb, schema } from "./db";
import { trustedOrigins } from "./env";
import { verifyPasswordHash } from "./services/accounts";
import { checkThrottle, clearThrottle, recordFailure } from "./services/throttle";
import { createHash } from "node:crypto";

export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 429,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface Principal {
  userId: string;
  displayName: string;
  role: "student" | "teacher";
  groupId: string;
  groupName: string;
  twoFactorEnabled: boolean;
  sessionId: string;
}

/**
 * Hämtar inloggad användare ur sessionscookien och KONTROLLERAR mot databasen vid varje anrop:
 * kontot ska vara aktivt och ha medlemskap. Roll och grupp läses från medlemskapet, aldrig från klienten.
 * (Ingen cookie-cache i auth-konfigurationen, så ändringar får omedelbar effekt.)
 */
export async function authenticate(request: Request): Promise<Principal | null> {
  const s = await getAuth().api.getSession({ headers: request.headers });
  if (!s) return null;
  const rows = await getDb()
    .select({
      role: schema.memberships.role,
      groupId: schema.memberships.groupId,
      groupName: schema.groups.name,
      deactivatedAt: schema.user.deactivatedAt,
      twoFactorEnabled: schema.user.twoFactorEnabled,
      name: schema.user.name,
    })
    .from(schema.user)
    .innerJoin(schema.memberships, eq(schema.memberships.userId, schema.user.id))
    .innerJoin(schema.groups, eq(schema.groups.id, schema.memberships.groupId))
    .where(eq(schema.user.id, s.user.id))
    .orderBy(asc(schema.memberships.createdAt))
    .limit(1);
  const r = rows[0];
  if (!r || r.deactivatedAt) return null;
  return {
    userId: s.user.id,
    displayName: r.name,
    role: r.role as "student" | "teacher",
    groupId: r.groupId,
    groupName: r.groupName,
    twoFactorEnabled: Boolean(r.twoFactorEnabled),
    sessionId: s.session.id,
  };
}

export async function requireUser(request: Request): Promise<Principal> {
  const p = await authenticate(request);
  if (!p) throw new HttpError(401, "unauthenticated", "Du är inte inloggad.");
  return p;
}

export async function requireStudent(request: Request): Promise<Principal> {
  const p = await requireUser(request);
  if (p.role !== "student") throw new HttpError(403, "forbidden", "Åtgärden är bara för elever.");
  return p;
}

/** Aktiv lärare. Tvåfaktor är valfritt: har läraren registrerat det krävs det vid inloggning, men det krävs inte för administration. */
export async function requireTeacher(request: Request): Promise<Principal> {
  const p = await requireUser(request);
  if (p.role !== "teacher") throw new HttpError(403, "forbidden", "Åtgärden kräver lärarbehörighet.");
  return p;
}

/** Skyddar mot CSRF: tillstånds­ändrande anrop måste komma från ett tillåtet ursprung och vara JSON. */
export function assertSameOrigin(request: Request): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  const allowed = new Set(trustedOrigins());
  if (!origin || !allowed.has(origin)) throw new HttpError(403, "bad-origin", "Anropet kommer från ett otillåtet ursprung.");
  const ct = request.headers.get("content-type") ?? "";
  if (request.method !== "DELETE" && !ct.toLowerCase().startsWith("application/json")) throw new HttpError(400, "bad-content-type", "Innehållet måste vara JSON.");
}

/** Kräver ett tillåtet Origin även för anrop utan cookies (skyddar mot inloggnings-CSRF). */
export function assertAllowedOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin || !new Set(trustedOrigins()).has(origin)) throw new HttpError(403, "bad-origin", "Anropet kommer från ett otillåtet ursprung.");
}

const confirmKey = (userId: string) => createHash("sha256").update(`confirm:${userId}`).digest("hex");

/**
 * Ny autentisering vid känsliga administratörsåtgärder: läraren bekräftar sitt lösenord.
 * Misslyckade försök räknas och spärras tillfälligt (beständigt i databasen).
 */
export async function requirePasswordConfirmation(principal: Principal, password: unknown): Promise<void> {
  const key = confirmKey(principal.userId);
  if ((await checkThrottle(key)).locked) throw new HttpError(429, "too-many-attempts", "För många försök. Vänta en stund.");
  if (typeof password !== "string" || password.length === 0 || password.length > 256) throw new HttpError(403, "reauth-required", "Bekräfta med ditt lösenord.");
  const acc = await getDb()
    .select({ password: schema.account.password })
    .from(schema.account)
    .where(and(eq(schema.account.userId, principal.userId), eq(schema.account.providerId, "credential")))
    .limit(1);
  const hash = acc[0]?.password;
  const ok = hash ? await verifyPasswordHash(hash, password) : false;
  if (!ok) {
    await recordFailure(key);
    throw new HttpError(403, "reauth-failed", "Lösenordet stämmer inte.");
  }
  await clearThrottle(key);
}
