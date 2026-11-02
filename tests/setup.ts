import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  try { window.localStorage.clear(); } catch { /* ignore */ }
});

// Miljö för serverrelaterade tester (lokal PostgreSQL, aldrig Neon eller produktion).
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://japan_app:devonly_local_password@localhost:5432/japanresan_test";
process.env.DB_TARGET = "test";
process.env.BETTER_AUTH_SECRET = "test-only-secret-0123456789-0123456789-abcdefghij";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.AUTH_RATE_LIMIT_ENABLED = "false";
process.env.DATABASE_POOL_MAX = "10";
// De befintliga server- och kontotesterna kör i kontoläge. Det kontofria läget testas separat (tests/konton-avstangda.test.ts).
process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED = "true";
