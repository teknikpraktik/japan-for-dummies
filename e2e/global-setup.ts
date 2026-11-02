import { execSync } from "node:child_process";

export default function globalSetup() {
  execSync("npx tsx scripts/e2e-reset.mts", { stdio: "pipe" });
}
