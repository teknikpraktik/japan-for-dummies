import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * En poolad anslutning per serverinstans. Använd Neons *pooled* anslutningssträng (host med -pooler)
 * på Vercel. Pool-storleken hålls låg eftersom varje funktionsinstans har egen pool.
 */
const globalForDb = globalThis as unknown as { __japanPool?: Pool };

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL saknas");
  const pool = new Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_MAX ?? 5), idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 });
  pool.on("error", () => {
    /* Inaktiva klientfel loggas inte med anslutningsuppgifter. */
  });
  return pool;
}

export function getPool(): Pool {
  if (!globalForDb.__japanPool) globalForDb.__japanPool = createPool();
  return globalForDb.__japanPool;
}

let cachedDb: ReturnType<typeof makeDb> | undefined;
function makeDb() {
  return drizzle(getPool(), { schema });
}
/** Lazy: ingen anslutning skapas vid import (bygget behöver inte databas). */
export function getDb() {
  return (cachedDb ??= makeDb());
}
export type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
