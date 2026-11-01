import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* =====================================================================
 * Better Auth (kärntabeller + plugin username och twoFactor).
 * Tabellernas form följer Better Auths dokumenterade schema. Ändra inte
 * kolumnnamn utan att kontrollera mot biblioteket (se tests/server/auth-schema).
 * ===================================================================== */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  /** Visningsnamn (förnamn eller alias). Inte unikt. */
  name: text("name").notNull(),
  /** Lärare: verklig e-postadress (inloggningsnamn). Elever: intern identifierare under .invalid, aldrig e-post. */
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  /** Avaktiverat konto: kan inte logga in, sessioner är avslutade. */
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    /** Lösenordshash från Better Auth (inloggningskod för elever). */
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").notNull().default(true),
    failedVerificationCount: integer("failed_verification_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
  (t) => [index("two_factor_user_id_idx").on(t.userId), index("two_factor_secret_idx").on(t.secret)],
);

/** Better Auths beständiga hastighetsbegränsning (fungerar över flera serverinstanser). */
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/* =====================================================================
 * Applikationens tabeller
 * ===================================================================== */
export const groups = pgTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("memberships_group_user_uq").on(t.groupId, t.userId),
    index("memberships_user_idx").on(t.userId),
    check("memberships_role_ck", sql`${t.role} in ('student','teacher')`),
  ],
);

/** Centralt framsteg: endast det som behövs för uppföljning (ingen svarshistorik, inga klick, ingen lästid). */
export const progress = pgTable(
  "progress",
  {
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").notNull(),
    /** Kapitelversion som status gäller. */
    chapterVersion: integer("chapter_version").notNull(),
    status: text("status").notNull(),
    /** quiz = bekräftat via serverns kontroll av testet; imported = självrapporterat från äldre lokala framsteg. */
    source: text("source").notNull().default("quiz"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedVersion: integer("completed_version"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.chapterId] }),
    check("progress_status_ck", sql`${t.status} in ('started','completed')`),
    check("progress_source_ck", sql`${t.source} in ('quiz','imported')`),
  ],
);

/** När elevens framsteg senast synkades (visas för lärare som tidpunkt, inte som närvaroövervakning). */
export const syncState = pgTable("sync_state", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Engångsflöde för nya lärare. Endast hash av token lagras. */
export const teacherActivations = pgTable(
  "teacher_activations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (t) => [index("teacher_activations_user_idx").on(t.userId)],
);

/** Begränsad säkerhetslogg över konto-, roll- och kodändringar. Inga hemligheter, inga namn, inga koder. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    groupId: text("group_id").references(() => groups.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetUserId: text("target_user_id"),
    details: jsonb("details").$type<Record<string, string | number | boolean | null>>(),
  },
  (t) => [index("audit_log_at_idx").on(t.at)],
);

/** Beständig kontobaserad begränsning av upprepade inloggningsförsök (nyckel = hash av normaliserat användarnamn). */
export const loginThrottle = pgTable("login_throttle", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

/** Spårar att äldre lokala framsteg har importerats (upprepning ändrar inget). */
export const legacyImports = pgTable("legacy_imports", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  chapterCount: integer("chapter_count").notNull(),
});

export const userRelations = relations(user, ({ many }) => ({ memberships: many(memberships), progress: many(progress) }));
export const membershipRelations = relations(memberships, ({ one }) => ({
  user: one(user, { fields: [memberships.userId], references: [user.id] }),
  group: one(groups, { fields: [memberships.groupId], references: [groups.id] }),
}));
