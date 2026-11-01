import { defineConfig, devices } from "@playwright/test";
import { serverEnv } from "./e2e/env";

const PORT = 4173;
// I Anthropic-miljön används förinstallerad Chromium via CHROMIUM_PATH. Lokalt/CI används Playwrights egen.
const executablePath = process.env.CHROMIUM_PATH || undefined;
const launchOptions = { executablePath, args: ["--no-sandbox"] };

export default defineConfig({
  testDir: "./e2e",
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
  // Testerna körs mot produktionsbygget (.next). Kör `npm run build` först. Servern använder den lokala e2e-databasen.
  webServer: { command: `npx next start -p ${PORT}`, url: `http://localhost:${PORT}`, reuseExistingServer: false, timeout: 60_000, env: serverEnv(PORT) as Record<string, string> },
});
