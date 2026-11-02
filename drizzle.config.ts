import { defineConfig } from "drizzle-kit";

// Används bara för `npm run db:generate` (skapar SQL-migreringar). Migreringar körs med scripts/migrate.mts.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://invalid" },
});
