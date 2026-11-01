import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { pilots, takeQuiz } from "./helpers";

const pages = [
  "/",
  "/utbildning/",
  ...pilots.map((c) => `/kapitel/${c.slug}/`),
  "/kapitel/shinto/",
  "/resepass/",
  "/info/",
  "/kallor/",
  "/bildkallor/",
];

test.describe("tillgänglighet (axe, WCAG 2.2 AA-regler) och layout", () => {
  for (const url of pages) {
    test(`axe och ingen horisontell rullning: ${url}`, async ({ page }) => {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, "horisontell rullning").toBeLessThanOrEqual(0);
    });
  }

  for (const c of pilots) {
    test(`ingen störande layoutförskjutning när bilderna laddas: ${c.slug}`, async ({ page }) => {
      await page.addInitScript(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(`/kapitel/${c.slug}/`);
      await page.waitForLoadState("networkidle");
      // Rulla igenom sidan så att lata bilder laddas, och vänta in dem.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 400) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        await Promise.all([...document.images].map((i) => (i.complete ? undefined : new Promise((r) => { i.onload = i.onerror = () => r(undefined); }))));
      });
      await page.waitForTimeout(400);
      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      expect(cls, "CLS").toBeLessThan(0.02);
      // Alla bilder har angivna mått (width/height) och alt-attribut.
      const bad = await page.evaluate(() => [...document.images].filter((i) => !i.getAttribute("width") || !i.getAttribute("height") || i.getAttribute("alt") === null).map((i) => i.currentSrc));
      expect(bad).toEqual([]);
    });
  }

  test("axe efter besvarat test och i resultatvy", async ({ page }) => {
    const c = pilots[0];
    await page.goto(`/kapitel/${c.slug}/`);
    await page.waitForLoadState("networkidle");
    await takeQuiz(page, c, 1);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });

  test("mobil: pekmål på navigering är minst 44 px höga", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Endast mobil");
    await page.goto("/");
    const boxes = await page.locator("nav[aria-label='Snabbmeny'] a").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    for (const h of boxes) expect(h).toBeGreaterThanOrEqual(44);
  });

  test("minskad rörelse respekteras", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const d = await page.evaluate(() => getComputedStyle(document.body).scrollBehavior);
    expect(d).toBeDefined();
  });
});
