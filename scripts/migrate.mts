/**
 * Kör SQL-migreringar (drizzle/) mot databasen i DATABASE_URL.
 *   DATABASE_URL=... npm run db:migrate
 * Migreringar är additiva och körs i en transaktion per migrering. Kör aldrig mot produktion utan backup/branch (docs/OPERATIONS.md).
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL saknas.");
  process.exit(1);
}
const target = process.env.DB_TARGET ?? "(ej satt)";
if (target === "production" && process.env.CONFIRM_PRODUCTION_MIGRATION !== "yes") {
  console.error("DB_TARGET=production: sätt CONFIRM_PRODUCTION_MIGRATION=yes för att bekräfta (ta backup/branch först).");
  process.exit(1);
}
const pool = new Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  console.log(`Migreringar körda (mål: ${target}).`);
} finally {
  await pool.end();
}
