/**
 * Gemensam miljö för e2e-servrar.
 *  - Standard (kontofritt läge): ingen databas, inga autentiseringsvariabler. Appen ska fungera utan dem.
 *  - Kontoläge (E2E_MODE=konton, se playwright.konton.config.ts): lokal databas och syntetiska konton, aldrig Neon/produktion.
 */
export const E2E_DB = process.env.E2E_DATABASE_URL ?? "postgres://japan_app:devonly_local_password@localhost:5432/japanresan_e2e";
export const E2E_SECRET = "e2e-only-secret-0123456789-0123456789-abcdefghij";
export const isKonton = () => process.env.E2E_MODE === "konton";
export const serverEnv = (port: number) => {
  const env: Record<string, string | undefined> = { ...process.env, PORT: String(port) };
  if (isKonton()) {
    return { ...env, DATABASE_URL: E2E_DB, DB_TARGET: "test", BETTER_AUTH_SECRET: E2E_SECRET, BETTER_AUTH_URL: `http://localhost:${port}`, AUTH_RATE_LIMIT_ENABLED: "false", NEXT_PUBLIC_ACCOUNTS_ENABLED: "true", NEXT_DIST_DIR: ".next-konton" };
  }
  for (const k of ["DATABASE_URL", "DB_TARGET", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "NEXT_PUBLIC_ACCOUNTS_ENABLED", "NEXT_DIST_DIR", "VERCEL_ENV"]) delete env[k];
  return env;
};
