import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    // Serverrelaterade tester delar en lokal testdatabas och körs därför en fil i taget.
    fileParallelism: false,
    globalSetup: ["./tests/server/global-setup.ts"],
    testTimeout: 30_000,
  },
});
