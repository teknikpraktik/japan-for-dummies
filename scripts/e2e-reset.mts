/** Återställer e2e-databasen (lokal) och skapar syntetiska elever. Används av Playwrights globalSetup. */
import { execSync } from "node:child_process";
import { Pool } from "pg";

const url = process.env.E2E_DATABASE_URL ?? "postgres://japan_app:devonly_local_password@localhost:5432/japanresan_e2e";
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1"].includes(host) && process.env.ALLOW_REMOTE_TEST_DB !== "yes") {
  console.error("E2E-databasen måste vara lokal (eller en dedikerad test-branch med ALLOW_REMOTE_TEST_DB=yes).");
  process.exit(2);
}
const pool = new Pool({ connectionString: url, max: 1 });
await pool.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
await pool.end();
const env = { ...process.env, DATABASE_URL: url, DB_TARGET: "test", BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "e2e-only-secret-0123456789-0123456789-abcdefghij" };
execSync("npx tsx scripts/migrate.mts", { env, stdio: "pipe" });
execSync("npx tsx scripts/seed-synthetic.mts", { env, stdio: "pipe" });
console.log("E2E-databasen är återställd och syntetiska elever är skapade.");
