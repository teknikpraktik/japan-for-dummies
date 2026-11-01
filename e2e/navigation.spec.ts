import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { pilots, takeQuiz } from "./helpers";

const themes: { id: string; order: number; title: string }[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/content/themes.json"), "utf8"));
const themeOf = (c: unknown) => (c as { themeId: string }).themeId;
const isMobile = (p: Page) => (p.viewportSize()?.width ?? 1200) < 1024;

async function ensureNavVisible(page: Page) {
  if (isMobile(page) && !(await page.getByTestId("education-nav").isVisible())) await page.getByTestId("nav-open").click();
  await expect(page.getByTestId("education-nav")).toBeVisible();
}

test.describe("utbildningens navigation", () => {
  test("första besöket visar tema 1, ett tema åt gången, alla 12 teman i spalten", async ({ page }) => {
    await page.goto("/utbildning/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(themes[0].title);
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(5);
    await ensureNavVisible(page);
    await expect(page.locator("[data-testid^='nav-theme-']")).toHaveCount(12);
    for (const t of themes) await expect(page.getByTestId(`nav-theme-${t.id}`)).toContainText(`${t.order}.`);
    await expect(page.getByTestId(`nav-theme-${themes[0].id}`)).toHaveAttribute("aria-current", "page");
  });

  test("temabyte via URL, omladdning, bakåt och utfällning med separat pilknapp", async ({ page }) => {
    await page.goto("/utbildning/");
    await ensureNavVisible(page);
    await page.getByTestId("nav-theme-mat").click();
    await expect(page).toHaveURL(/\/utbildning\/mat\/$/);
    const mat = themes.find((t) => t.id === "mat")!;
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(mat.title);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(mat.title);
    await ensureNavVisible(page);
    await expect(page.getByTestId("nav-theme-mat")).toHaveAttribute("aria-current", "page");
    const toggle = page.getByTestId("nav-toggle-mat");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page).toHaveURL(/\/utbildning\/mat\/$/);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.goBack();
    await expect(page).toHaveURL(/\/utbildning\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(themes[0].title);
  });

  test("okänt tema ger 404", async ({ page }) => {
    const res = await page.goto("/utbildning/finns-inte/");
    expect(res?.status()).toBe(404);
  });

  test("kapitelkort öppnar kapitlet; tillbaka till översikten behåller temat", async ({ page }) => {
    const c = pilots.find((x) => themeOf(x) === "mat")!;
    await page.goto("/utbildning/mat/");
    await page.getByTestId(`chapter-card-${c.id}`).getByRole("link", { name: c.title }).click();
    await expect(page).toHaveURL(new RegExp(`/kapitel/${c.slug}/$`));
    await page.getByRole("link", { name: /Till översikten/ }).first().click();
    await expect(page).toHaveURL(/\/utbildning\/mat\/$/);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/kapitel/${c.slug}/$`));
  });

  test("planerade kapitel: Kommer senare utan länk; bock bara för slutförda kapitel", async ({ page }) => {
    const done = pilots[0];
    await page.goto(`/kapitel/${done.slug}/`);
    await takeQuiz(page, done, 0);
    await page.goto(`/utbildning/${themeOf(done)}/`);
    await ensureNavVisible(page);
    await expect(page.getByTestId(`nav-done-${done.id}`)).toHaveCount(1);
    await expect(page.getByTestId(`nav-done-${done.id}`)).toContainText("Slutfört");
    await expect(page.locator("[data-testid^='nav-done-']")).toHaveCount(1); // publicerat är inte slutfört
    const planned = page.locator("[data-testid^='nav-planned-']").first();
    await expect(planned).toContainText("Kommer senare");
    await expect(planned.getByRole("link")).toHaveCount(0);
    await expect(page.locator("[data-testid^='chapter-card-']").first()).toBeVisible();
  });

  test("tangentbord: tema-länk och pilknapp nås med Tab", async ({ page }) => {
    test.skip(isMobile(page), "desktop");
    await page.goto("/utbildning/");
    await page.getByTestId("nav-theme-geografi").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("nav-toggle-geografi")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("nav-toggle-geografi")).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("nav-theme-historia")).toBeFocused();
  });

  test("layout: spalten 260–300 px, små oförvrängda bilder, ingen sidoscroll", async ({ page }) => {
    await page.goto("/utbildning/");
    await page.waitForLoadState("networkidle");
    if (!isMobile(page)) {
      const w = (await page.getByTestId("education-nav").boundingBox())!.width;
      expect(w).toBeGreaterThanOrEqual(260);
      expect(w).toBeLessThanOrEqual(300);
      const thumb = (await page.getByTestId("card-thumb").first().boundingBox())!;
      expect(thumb.width).toBeGreaterThanOrEqual(140);
      expect(thumb.width).toBeLessThanOrEqual(180);
    }
    const fit = await page.locator("[data-testid='card-thumb'] img").first().evaluate((el) => getComputedStyle(el).objectFit);
    expect(fit).toBe("cover");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("mobil: panel öppnas, visar aktuellt tema när stängd, stängs efter val och med Escape", async ({ page }) => {
    test.skip(!isMobile(page), "mobil");
    await page.goto("/utbildning/");
    const opener = page.getByTestId("nav-open");
    await expect(opener).toContainText(`Tema 1: ${themes[0].title}`);
    await expect(page.getByTestId("education-nav")).toBeHidden();
    await opener.click();
    await expect(opener).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("education-nav")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("education-nav")).toBeHidden();
    await expect(opener).toBeFocused();
    await opener.click();
    await page.getByTestId("nav-theme-sprak").click();
    await expect(page).toHaveURL(/\/utbildning\/sprak\/$/);
    await expect(page.getByTestId("education-nav")).toBeHidden();
    await expect(opener).toContainText("Tema 5");
  });
});
