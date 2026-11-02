import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "../db";

/** Efter så här många misslyckade försök inom fönstret spärras identifieraren tillfälligt. */
export const MAX_FAILURES = 10;
export const WINDOW_MS = 15 * 60 * 1000;
export const LOCK_MS = 15 * 60 * 1000;

export async function checkThrottle(key: string): Promise<{ locked: boolean }> {
  const rows = await getDb().select().from(schema.loginThrottle).where(eq(schema.loginThrottle.key, key)).limit(1);
  const r = rows[0];
  return { locked: Boolean(r?.lockedUntil && r.lockedUntil.getTime() > Date.now()) };
}

/** Atomisk ökning (en rad per nyckel). Nollställer fönstret om det har gått ut. */
export async function recordFailure(key: string): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MS);
  const lockUntil = new Date(now.getTime() + LOCK_MS);
  await getDb().execute(sql`
    INSERT INTO login_throttle (key, failures, window_started_at, locked_until)
    VALUES (${key}, 1, ${now.toISOString()}, NULL)
    ON CONFLICT (key) DO UPDATE SET
      failures = CASE WHEN login_throttle.window_started_at < ${windowStart.toISOString()} THEN 1 ELSE login_throttle.failures + 1 END,
      window_started_at = CASE WHEN login_throttle.window_started_at < ${windowStart.toISOString()} THEN ${now.toISOString()} ELSE login_throttle.window_started_at END,
      locked_until = CASE
        WHEN login_throttle.window_started_at >= ${windowStart.toISOString()} AND login_throttle.failures + 1 >= ${MAX_FAILURES} THEN ${lockUntil.toISOString()}
        ELSE login_throttle.locked_until END
  `);
}

export async function clearThrottle(key: string): Promise<void> {
  await getDb().delete(schema.loginThrottle).where(eq(schema.loginThrottle.key, key));
}
