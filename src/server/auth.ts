import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { twoFactor, username } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { baseUrl, getEnv, isProduction, trustedOrigins } from "./env";
import { getDb, schema } from "./db";
import { checkThrottle, clearThrottle, recordFailure } from "./services/throttle";

/**
 * Endpoints i Better Auth som INTE ska vara nåbara. Ingen öppen registrering, ingen e-postbaserad
 * återställning (inget e-postsystem), inga profiländringar från klienten (skyddar namn/användarnamn),
 * ingen uppräkning av användarnamn. Kontrolleras av tests/server/auth-closed.test.ts.
 */
export const DISABLED_AUTH_PATHS = [
  "/sign-up/email",
  "/sign-in/magic-link",
  "/request-password-reset",
  "/reset-password",
  "/reset-password/:token",
  "/send-verification-email",
  "/verify-email",
  "/change-email",
  "/update-user",
  "/delete-user",
  "/delete-user/callback",
  "/is-username-available",
  "/sign-in/social",
  "/link-social",
  "/unlink-account",
  "/list-accounts",
  "/callback/:id",
  "/get-access-token",
  "/refresh-token",
  "/account-info",
  "/update-session",
  // Eget lösenordsbekräftelseflöde används för känsliga åtgärder (undviker ett fritt lösenordsorakel).
  "/verify-password",
  // Ingen e-post/SMS: engångskoder via OTP används inte.
  "/two-factor/send-otp",
  "/two-factor/verify-otp",
];

export const SESSION_LIFETIME_SECONDS = 60 * 60 * 12; // 12 timmar

/** Normaliserar identifierare så att försöksräknaren inte kan kringgås med skiftläge/blanksteg. */
export function throttleKey(identifier: string): string {
  const norm = identifier.trim().toLowerCase();
  return createHash("sha256").update(`login:${norm}`).digest("hex");
}

export interface AuthOptions {
  rateLimitEnabled?: boolean;
}

export function createAuth(opts: AuthOptions = {}) {
  const env = getEnv();
  const prod = isProduction();
  const rateLimitEnabled = opts.rateLimitEnabled ?? (env.AUTH_RATE_LIMIT_ENABLED ? env.AUTH_RATE_LIMIT_ENABLED === "true" : env.DB_TARGET !== "test");

  return betterAuth({
    appName: "Japanresan 2027",
    baseURL: baseUrl(),
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: trustedOrigins(),
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification, twoFactor: schema.twoFactor, rateLimit: schema.rateLimit },
    }),
    // Inloggning med lösenord. Elevens inloggningskod är lösenordet (Better Auths standardhashning, scrypt).
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    // Ingen social inloggning, inga e-postflöden.
    disabledPaths: DISABLED_AUTH_PATHS,
    session: {
      expiresIn: SESSION_LIFETIME_SECONDS,
      updateAge: 60 * 60,
      // Ingen cookie-cache: roll och aktiv status kontrolleras mot databasen vid varje begäran.
      cookieCache: { enabled: false },
    },
    user: {
      additionalFields: {
        deactivatedAt: { type: "date", required: false, input: false },
      },
    },
    advanced: {
      useSecureCookies: prod || env.VERCEL_ENV === "preview",
      cookiePrefix: "japanresan",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
      // Vercel sätter dessa från den verkliga anslutningen (inte klientstyrda).
      ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"] },
    },
    // Beständig, flerinstansfast begränsning (lagras i databasen).
    rateLimit: {
      enabled: rateLimitEnabled,
      storage: "database",
      modelName: "rateLimit",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/username": { window: 60, max: 8 },
        "/sign-in/email": { window: 60, max: 8 },
        "/two-factor/verify-totp": { window: 60, max: 8 },
        "/two-factor/verify-backup-code": { window: 60, max: 5 },
        "/change-password": { window: 60, max: 5 },
      },
    },
    plugins: [
      username({
        minUsernameLength: 6,
        maxUsernameLength: 30,
      }),
      twoFactor({
        issuer: "Japanresan 2027",
        backupCodeOptions: { amount: 10, length: 10 },
      }),
    ],
    databaseHooks: {
      session: {
        create: {
          // Försvar på djupet: avaktiverade konton får aldrig en ny session.
          before: async (session) => {
            const rows = await getDb().select({ d: schema.user.deactivatedAt }).from(schema.user).where(eq(schema.user.id, session.userId)).limit(1);
            if (!rows[0] || rows[0].d) return false;
            return { data: session };
          },
        },
      },
    },
    hooks: {
      // Kontobaserat skydd mot upprepade inloggningsförsök (kompletterar IP-baserad begränsning).
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/username" && ctx.path !== "/sign-in/email") return;
        const body = (ctx.body ?? {}) as { username?: string; email?: string };
        const id = body.username ?? body.email;
        if (typeof id !== "string" || !id) return;
        const status = await checkThrottle(throttleKey(id));
        if (status.locked) {
          // Generellt meddelande: avslöjar inte om kontot finns.
          throw new APIError("TOO_MANY_REQUESTS", { message: "För många försök. Vänta en stund och försök igen." });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/username" && ctx.path !== "/sign-in/email") return;
        const body = (ctx.body ?? {}) as { username?: string; email?: string };
        const id = body.username ?? body.email;
        if (typeof id !== "string" || !id) return;
        const key = throttleKey(id);
        const returned = ctx.context.returned;
        if (returned instanceof APIError) {
          await recordFailure(key);
        } else {
          await clearThrottle(key);
        }
      }),
    },
  });
}

type AuthInstance = ReturnType<typeof createAuth>;
const g = globalThis as unknown as { __japanAuth?: AuthInstance };

/** Singleton per serverinstans. */
export function getAuth(): AuthInstance {
  return (g.__japanAuth ??= createAuth());
}
