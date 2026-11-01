import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pilots, takeQuiz } from "./helpers";

/**
 * Offlinetesterna kör mot en egen kopia av produktionsbygget (out/) på en separat port.
 * Servern stoppas mitt i testet, så att nätverket verkligen är borta (även för service workern).
 */
const PORT = 4174;
const BASE = `http://localhost:${PORT}`;
let server: ChildProcess | undefined;
let dir = "";

async function startServer(root: string) {
  server = spawn("npx", ["serve", root, "-l", String(PORT), "--no-clipboard"], { stdio: "ignore", detached: true });
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`${BASE}/offline.html`);
      if (r.ok) return;
    } catch { /* inte uppe än */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Servern startade inte");
}
function killServer() {
  if (server?.pid) {
    try { process.kill(-server.pid); } catch { /* redan stoppad */ }
  }
  server = undefined;
}
/** Stoppar servern och väntar tills den verkligen inte svarar längre. */
async function stopServer() {
  killServer();
  await expect.poll(() => fetch(`${BASE}/offline.html`).then(() => true, () => false), { timeout: 10_000 }).toBe(false);
}

test.beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "japan-out-"));
  fs.cpSync(path.join(process.cwd(), "out"), dir, { recursive: true });
  await startServer(dir);
});
test.afterEach(() => {
  killServer();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function waitForController(page: Page) {
  await expect
    .poll(() => page.evaluate(async () => { await navigator.serviceWorker.ready; return Boolean(navigator.serviceWorker.controller); }), { timeout: 20_000 })
    .toBe(true);
}

test.use({ baseURL: BASE });

test.describe("offline", () => {
  test.skip(({ isMobile }) => isMobile, "Körs på desktop; samma kod används på mobil");

  test("efter nedladdning: omladdning, direktlänkar och test fungerar utan nätverk", async ({ page }) => {
    await page.goto("/info/");
    await waitForController(page);

    await page.getByTestId("offline-download").click();
    await expect(page.getByTestId("offline-ready")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId("offline-ready")).toContainText("Klart för offline");

    await stopServer(); // nätverket är nu borta

    // Omladdning offline
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: /Info: lagring/ })).toBeVisible();
    await expect(page.getByTestId("offline-ready")).toBeVisible();

    // Direktlänk till alla sex pilotkapitel offline
    for (const c of pilots) {
      await page.goto(`/kapitel/${c.slug}/`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(c.title);
    }
    // Hela kapitlet inklusive test och sparade framsteg offline
    const c = pilots[0];
    await page.goto(`/kapitel/${c.slug}/`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("img[alt^='Förenklad karta']")).toBeVisible();
    await expect.poll(() => page.evaluate(() => (document.querySelector("img") as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await takeQuiz(page, c, 0);
    await expect(page.getByTestId("quiz-result")).toContainText("Klar");

    // Navigering via länkar, och planerat kapitel, översikt, resepass, källor offline
    await page.getByRole("link", { name: "Till översikten" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Utbildningsöversikt" })).toBeVisible();
    await page.goto("/kapitel/shinto/");
    await expect(page.getByText("planerat men inte skrivet än")).toBeVisible();
    await page.goto("/resepass/");
    await expect(page.getByTestId("stat-completed")).toHaveText("1 / 6");
    await page.goto("/kallor/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Källor och rättigheter");

    // En sida som aldrig laddades ned visar ett begripligt meddelande
    await page.goto("/finns-inte-offline/");
    await expect(page.getByRole("heading", { name: "Den här sidan är inte sparad offline" })).toBeVisible();
  });

  test("utan nedladdning visar offlinemeddelande", async ({ page }) => {
    await page.goto("/");
    await waitForController(page);
    await stopServer();
    await page.goto("/utbildning/");
    await expect(page.getByRole("heading", { name: "Den här sidan är inte sparad offline" })).toBeVisible();
    await expect(page.getByText("Dina framsteg är säkra")).toBeVisible();
  });

  test("avbruten nedladdning markeras inte som klar och kan fortsättas", async ({ page }) => {
    await page.goto("/info/");
    await waitForController(page);
    // Låt en fil saknas på servern (svarar 404) så att nedladdningen avbryts.
    const victim = path.join(dir, "kapitel", "att-ata-i-japan");
    fs.renameSync(victim, victim + ".bak");
    await page.getByTestId("offline-download").click();
    await expect(page.getByRole("alert").filter({ hasText: "inte klar" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("offline-ready")).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("japanresan:v1:offline"))).toBeNull();
    // Fortsätt
    fs.renameSync(victim + ".bak", victim);
    await page.getByRole("button", { name: "Fortsätt nedladdningen" }).click();
    await expect(page.getByTestId("offline-ready")).toBeVisible({ timeout: 90_000 });
  });

  test("ny version: uppdatering erbjuds, pågående test och framsteg bevaras", async ({ page }) => {
    await page.goto("/info/");
    await waitForController(page);
    await page.getByTestId("offline-download").click();
    await expect(page.getByTestId("offline-ready")).toBeVisible({ timeout: 90_000 });

    // Starta ett test och besvara två frågor.
    const c = pilots[0];
    await page.goto(`/kapitel/${c.slug}/`);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("start-quiz").click();
    for (let i = 0; i < 2; i++) {
      const legend = await page.locator("#test fieldset legend").first().textContent();
      const q = c.quiz.find((x) => x.prompt === legend)!;
      await page.locator("#test").getByRole("radio", { name: q.options.find((o) => o.correct)!.text, exact: true }).check();
      await page.getByTestId("answer").click();
      await page.getByTestId("next-question").click();
    }

    // Simulera nytt bygge: byt bygg-id i sw.js och manifest, och ändra en fil.
    const swPath = path.join(dir, "sw.js");
    const manifestPath = path.join(dir, "offline-manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const oldId = manifest.buildId as string;
    const newId = "nyttbygge01";
    fs.writeFileSync(swPath, fs.readFileSync(swPath, "utf8").split(oldId).join(newId));
    manifest.buildId = newId;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    fs.appendFileSync(path.join(dir, "offline.html"), "\n<!-- v2 -->");

    await page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); await reg?.update(); });
    await expect(page.getByText("Det finns en ny version av utbildningen.")).toBeVisible({ timeout: 20_000 });
    // Sidan laddas inte om av sig själv: testet pågår fortfarande
    await expect(page.getByTestId("quiz-position")).toHaveText("Fråga 3 av 5");

    await page.getByRole("button", { name: "Uppdatera nu" }).click();
    await page.waitForLoadState("load");
    await expect(page.getByTestId("quiz-position")).toHaveText("Fråga 3 av 5"); // svar kvar efter uppdatering

    // Offlineinnehållet kan uppdateras; framstegen finns kvar
    await page.goto("/info/");
    await expect(page.getByText("Det finns ett nyare innehåll")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Uppdatera offlineinnehållet" }).click();
    await expect(page.getByTestId("offline-ready")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText("Det finns ett nyare innehåll")).toHaveCount(0);
    const caches = await page.evaluate(async () => (await window.caches.keys()).filter((k) => k.startsWith("japanresan-offline-")));
    expect(caches).toEqual([`japanresan-offline-${newId}`]);
    await page.goto(`/kapitel/${c.slug}/`);
    await expect(page.getByTestId("quiz-position")).toHaveText("Fråga 3 av 5");
  });
});
