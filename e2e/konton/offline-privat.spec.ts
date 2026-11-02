import { expect, test, type Page } from "@playwright/test";
import { loginStudentOk } from "../auth-helpers";
import { NextCopy } from "../next-server";
import { pilots } from "../helpers";

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

test.describe("offline (kontoläge)", () => {
  test.skip(({ isMobile }) => isMobile, "Körs på desktop; samma kod används på mobil");

  test("skyddat och personligt innehåll hamnar aldrig i offlinecachen och visas aldrig offline", async ({ page }) => {
    await page.goto("/offline/");
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

});
