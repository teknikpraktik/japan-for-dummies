/** Gemensam miljö för e2e-servrar (lokal databas, syntetiska konton, aldrig Neon/produktion). */
export const E2E_DB = process.env.E2E_DATABASE_URL ?? "postgres://japan_app:devonly_local_password@localhost:5432/japanresan_e2e";
export const E2E_SECRET = "e2e-only-secret-0123456789-0123456789-abcdefghij";
export const serverEnv = (port: number) => ({
  ...process.env,
  DATABASE_URL: E2E_DB,
  DB_TARGET: "test",
  BETTER_AUTH_SECRET: E2E_SECRET,
  BETTER_AUTH_URL: `http://localhost:${port}`,
  AUTH_RATE_LIMIT_ENABLED: "false",
  PORT: String(port),
});
