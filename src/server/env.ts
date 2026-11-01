import { z } from "zod";

/**
 * Miljövariabler (endast server). Inga hemligheter loggas. Se docs/OPERATIONS.md.
 *
 * DB_TARGET anger vilken databas DATABASE_URL pekar på och måste matcha driftmiljön:
 *   development | test | preview | production
 * Preview-distributioner får aldrig köras mot DB_TARGET=production (kontrolleras i assertEnvironmentIsolation).
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL saknas"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET måste vara minst 32 tecken (slumpmässig)"),
  /** Publik bas-URL för den här distributionen. Utelämnas på Vercel-preview (VERCEL_BRANCH_URL används). */
  BETTER_AUTH_URL: z.string().url().optional(),
  DB_TARGET: z.enum(["development", "test", "preview", "production"]),
  /** Vercel sätter VERCEL_ENV till production | preview | development. */
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  VERCEL_URL: z.string().optional(),
  VERCEL_BRANCH_URL: z.string().optional(),
  AUTH_RATE_LIMIT_ENABLED: z.enum(["true", "false"]).optional(),
  /** Konfigurerbar integritetsinformation. Inget förvalt värde hittas på. */
  PRIVACY_CONTROLLER_NAME: z.string().optional(),
  PRIVACY_CONTACT: z.string().optional(),
  PRIVACY_DPO_CONTACT: z.string().optional(),
  PRIVACY_RETENTION_POLICY: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Skriv bara ut variabelnamn och meddelanden, aldrig värden.
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Ogiltig miljökonfiguration: ${msg}`);
  }
  assertEnvironmentIsolation(parsed.data);
  cached = parsed.data;
  return cached;
}

/** Hindrar att preview mot produktionsdatabas och omvänt, samt att produktion körs mot fel mål. */
export function assertEnvironmentIsolation(env: Pick<Env, "DB_TARGET" | "VERCEL_ENV">): void {
  const v = env.VERCEL_ENV;
  if (v === "preview" && env.DB_TARGET === "production") {
    throw new Error("Förhandsvisning får inte använda produktionsdatabasen (DB_TARGET=production i en preview-miljö).");
  }
  if (v === "production" && env.DB_TARGET !== "production") {
    throw new Error("Produktionsmiljön måste använda DB_TARGET=production.");
  }
  if (v === "development" && env.DB_TARGET === "production") {
    throw new Error("Lokal utveckling får inte använda produktionsdatabasen.");
  }
  if (!v && env.DB_TARGET === "production" && process.env.NODE_ENV !== "production") {
    throw new Error("DB_TARGET=production kräver NODE_ENV=production.");
  }
}

export function isProduction(): boolean {
  const env = getEnv();
  return env.DB_TARGET === "production";
}

/** Tillåtna ursprung för den här distributionen. Inga jokertecken: en preview får bara lita på sin egen adress. */
export function trustedOrigins(): string[] {
  const env = getEnv();
  const out = new Set<string>();
  if (env.BETTER_AUTH_URL) out.add(new URL(env.BETTER_AUTH_URL).origin);
  if (env.VERCEL_ENV === "preview") {
    if (env.VERCEL_URL) out.add(`https://${env.VERCEL_URL}`);
    if (env.VERCEL_BRANCH_URL) out.add(`https://${env.VERCEL_BRANCH_URL}`);
  }
  if (env.DB_TARGET === "development" || env.DB_TARGET === "test") {
    out.add("http://localhost:3000");
    out.add("http://localhost:4173");
  }
  return [...out];
}

export function baseUrl(): string {
  const env = getEnv();
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL;
  if (env.VERCEL_ENV === "preview" && env.VERCEL_BRANCH_URL) return `https://${env.VERCEL_BRANCH_URL}`;
  return "http://localhost:3000";
}
