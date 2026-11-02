import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loginStudentOk, loginTeacher } from "../auth-helpers";
import { pilots } from "../helpers";

test.describe("tillgänglighet och layout (kontoläge)", () => {
  test("axe: inloggningssidan", async ({ page }) => {
    await page.goto("/logga-in/");
    await page.waitForLoadState("networkidle");
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });

  test("axe och ingen horisontell rullning: elevens sidor", async ({ page }) => {
    await loginStudentOk(page, 3);
    for (const url of ["/min-utbildning/", "/konto/"]) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`), url).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), url).toBeLessThanOrEqual(0);
    }
  });

  test("kontomenyn: namn, Konto och Logga ut ligger på samma linje, även med långt namn och på mobil", async ({ page }) => {
    await loginStudentOk(page, 4);
    for (const longName of [false, true]) {
      if (longName) await page.getByTestId("account-name").evaluate((el) => (el.querySelector("span.truncate")!.textContent = "Alexandra-Maria Långnamnsson-Stenbock von Hohenzollern"));
      const boxes = await Promise.all([page.getByTestId("account-name"), page.getByRole("link", { name: "Konto", exact: true }), page.getByTestId("logout")].map((l) => l.boundingBox()));
      const centers = boxes.map((b) => b!.y + b!.height / 2);
      expect(Math.max(...centers) - Math.min(...centers), `mitten ${centers}`).toBeLessThanOrEqual(1);
      for (const b of boxes) expect(b!.height).toBeGreaterThanOrEqual(40);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      const right = Math.max(...boxes.map((b) => b!.x + b!.width));
      expect(right).toBeLessThanOrEqual(page.viewportSize()!.width);
    }
  });

  test("axe och ingen horisontell rullning: lärarens sidor", async ({ page }) => {
    await loginTeacher(page);
    for (const url of ["/lararen/", "/lararen/elever/", "/lararen/larare/"]) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`), url).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), url).toBeLessThanOrEqual(0);
    }
  });

  test("axe: kapitelsida med gemensam navigation, alla teman utfällda och mobilpanel öppen", async ({ page }) => {
    await page.goto(`/kapitel/${pilots[1].slug}/`);
    await page.waitForLoadState("networkidle");
    const wide = (page.viewportSize()?.width ?? 1200) >= 1024;
    if (!wide) await page.getByTestId("nav-open").click();
    for (const b of await page.locator("[data-testid^='nav-toggle-']").all()) if ((await b.getAttribute("aria-expanded")) === "false") await b.click();
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
  });
});
