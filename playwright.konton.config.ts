import { defineConfig, devices } from "@playwright/test";
import { serverEnv } from "./e2e/env";

// Kontoläget (NEXT_PUBLIC_ACCOUNTS_ENABLED=true) testas mot ett eget bygge i .next-konton: `npm run build:konton` först.
process.env.E2E_MODE = "konton";
process.env.NEXT_DIST_DIR = ".next-konton";

const PORT = 4175;
const executablePath = process.env.CHROMIUM_PATH || undefined;
const launchOptions = { executablePath, args: ["--no-sandbox"] };

export default defineConfig({
  testDir: "./e2e/konton",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", launchOptions },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions } },
    { name: "mobil", use: { ...devices["Pixel 5"], launchOptions } },
  ],
  webServer: { command: `npx next start -p ${PORT}`, url: `http://localhost:${PORT}`, reuseExistingServer: false, timeout: 60_000, env: serverEnv(PORT) as Record<string, string> },
});
