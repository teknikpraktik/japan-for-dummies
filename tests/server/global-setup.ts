import { execSync } from "node:child_process";
import { Pool } from "pg";

/** Tömmer och migrerar testdatabasen en gång före alla test (mot en lokal PostgreSQL, aldrig Neon/produktion). */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://japan_app:devonly_local_password@localhost:5432/japanresan_test";
  const u = new URL(url);
  if (!["localhost", "127.0.0.1"].includes(u.hostname) && process.env.ALLOW_REMOTE_TEST_DB !== "yes") {
    throw new Error("Testdatabasen måste vara lokal (sätt ALLOW_REMOTE_TEST_DB=yes för en dedikerad test-branch).");
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  await pool.end();
  execSync("npx tsx scripts/migrate.mts", { env: { ...process.env, DATABASE_URL: url, DB_TARGET: "test" }, stdio: "pipe" });
}
