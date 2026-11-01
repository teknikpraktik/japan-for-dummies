import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { loginStudentOk } from "./auth-helpers";
import { NextCopy } from "./next-server";
import { pilots, takeQuiz } from "./helpers";

/**
 * Offlinetesterna kör mot en egen kopia av produktionsbygget på en separat port. Servern stoppas mitt i testet,
 * så att nätverket verkligen är borta (även för service workern).
 */
const PORT = 4174;
const BASE = `http://localhost:${PORT}`;
let copy: NextCopy;

test.beforeEach(async () => {
  copy = new NextCopy(PORT);
  await copy.start();
});
test.afterEach(() => copy.cleanup());

const stopServer = () => copy.stopAndWait();

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
    // Alla bilder på alla pilotsidor (och startsidan) ska laddas från den lokala cachen. Tomt om inga bilder är valda än.
    for (const url of ["/", ...pilots.map((x) => `/kapitel/${x.slug}/`)]) {
      await page.goto(url);
      await page.waitForLoadState("load");
      // Tvinga in lata bilder (loading=lazy) och vänta tills alla är färdigladdade.
      await page.evaluate(async () => {
        document.querySelectorAll("img").forEach((i) => (i.loading = "eager"));
        await Promise.all([...document.images].map((i) => (i.complete ? undefined : new Promise((r) => { i.onload = i.onerror = () => r(undefined); }))));
      });
      const broken = await page.evaluate(() => [...document.images].filter((i) => i.currentSrc && i.naturalWidth === 0).map((i) => i.currentSrc));
      expect(broken, `trasiga bilder offline på ${url}`).toEqual([]);
    }
    // Hela kapitlet inklusive test och sparade framsteg offline
    const c = pilots[0];
    await page.goto(`/kapitel/${c.slug}/`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("img[alt^='Förenklad karta']")).toBeVisible();
    await expect.poll(() => page.evaluate(() => (document.querySelector("img[alt^='Förenklad karta']") as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
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

  test("skyddat och personligt innehåll hamnar aldrig i offlinecachen och visas aldrig offline", async ({ page }) => {
    await page.goto("/info/");
    await waitForController(page);
    await page.getByTestId("offline-download").click();
    await expect(page.getByTestId("offline-ready")).toBeVisible({ timeout: 90_000 });

    // Offlinelistan innehåller inga skyddade sökvägar
    const manifest = await (await fetch(`${BASE}/offline-manifest.json`)).json();
    const bad = (manifest.files as { url: string }[]).map((f) => f.url).filter((u) => /^\/(api|logga-in|min-utbildning|lararen|konto|aktivera)(\/|$)/.test(u));
    expect(bad).toEqual([]);

    // Logga in som elev och besök skyddade sidor och API genom service workern
    await loginStudentOk(page, 3);
    await page.goto("/min-utbildning/");
    await page.waitForLoadState("networkidle");
    await page.evaluate(async () => {
      await fetch("/api/me/");
      await fetch("/api/framsteg/");
    });
    await page.goto("/konto/");
    await page.waitForLoadState("networkidle");

    const cached = await page.evaluate(async () => {
      const out: string[] = [];
      for (const name of await caches.keys()) {
        const c = await caches.open(name);
        for (const r of await c.keys()) out.push(new URL(r.url).pathname);
      }
      return out;
    });
    expect(cached.length).toBeGreaterThan(50);
    expect(cached.filter((p) => /^\/(api|logga-in|min-utbildning|lararen|konto|aktivera)(\/|$)/.test(p))).toEqual([]);

    await stopServer();
    for (const url of ["/min-utbildning/", "/lararen/", "/konto/", "/logga-in/"]) {
      await page.goto(url);
      await expect(page.getByRole("heading", { name: "Den här sidan kräver internet" }), url).toBeVisible();
    }
    const apiResult = await page.evaluate(async () => {
      try {
        const r = await fetch("/api/me/");
        return `status ${r.status}`;
      } catch {
        return "nätverksfel";
      }
    });
    expect(apiResult).toBe("nätverksfel");
    // Utbildningens kapitel går fortfarande att läsa offline
    await page.goto("/kapitel/japan-pa-kartan/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(pilots[0].title);
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
    const chunks = path.join(copy.dir, ".next", "static", "chunks");
    const chunk = fs.readdirSync(chunks).find((f) => f.endsWith(".js"))!;
    const victim = path.join(chunks, chunk);
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
    const swPath = path.join(copy.dir, "public", "sw.js");
    const manifestPath = path.join(copy.dir, "public", "offline-manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const oldId = manifest.buildId as string;
    const newId = "nyttbygge01";
    fs.writeFileSync(swPath, fs.readFileSync(swPath, "utf8").split(oldId).join(newId));
    manifest.buildId = newId;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    fs.appendFileSync(path.join(copy.dir, "public", "offline.html"), "\n<!-- v2 -->");

    await page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); await reg?.update(); });
    await expect(page.getByText("Det finns en ny version av utbildningen.")).toBeVisible({ timeout: 20_000 });
    // Sidan laddas inte om av sig själv: testet pågår fortfarande
    await expect(page.getByTestId("quiz-position")).toHaveText("Fråga 3 av 5");

    // Användaren väljer att uppdatera: sidan laddas om först nu.
    await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Uppdatera nu" }).click()]);
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
