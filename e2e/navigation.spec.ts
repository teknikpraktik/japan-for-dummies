import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { pilots, takeQuiz, PLANNED_SAMPLE } from "./helpers";

const themes: { id: string; order: number; title: string; description: string }[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/content/themes.json"), "utf8"));
const themeOf = (c: unknown) => (c as { themeId: string }).themeId;
const isMobile = (p: Page) => (p.viewportSize()?.width ?? 1200) < 1024;

async function ensureNavVisible(page: Page) {
  if (isMobile(page) && !(await page.getByTestId("education-nav").isVisible())) await page.getByTestId("nav-open").click();
  await expect(page.getByTestId("education-nav")).toBeVisible();
}

test.describe("utbildningens navigation", () => {
  test("första besöket visar tema 1, ett tema åt gången, alla 12 teman i spalten", async ({ page }) => {
    await page.goto("/utbildning/");
    await expect(page).toHaveURL(/\/utbildning\/geografi\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(themes[0].title);
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(5);
    await ensureNavVisible(page);
    await expect(page.locator("[data-testid^='nav-theme-']")).toHaveCount(12);
    for (const t of themes) await expect(page.getByTestId(`nav-theme-${t.id}`)).toContainText(`${t.order}.`);
    await expect(page.getByTestId(`nav-theme-${themes[0].id}`)).toHaveAttribute("aria-current", "page");
  });

  test("temabyte via URL, omladdning, bakåt och utfällning med separat pilknapp", async ({ page }) => {
    await page.goto("/utbildning/geografi/");
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
    await expect(page).toHaveURL(/\/utbildning\/geografi\/$/);
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
    // Planerade kapitel finns bara kvar så länge något kapitel är oskrivet.
    if (PLANNED_SAMPLE) {
      const planned = page.locator("[data-testid^='nav-planned-']").first();
      await expect(planned).toContainText("Kommer senare");
      await expect(planned.getByRole("link")).toHaveCount(0);
    } else {
      await expect(page.locator("[data-testid^='nav-planned-']")).toHaveCount(0);
    }
    await expect(page.locator("[data-testid^='chapter-card-']").first()).toBeVisible();
  });

  test("tangentbord: tema-länk och pilknapp nås med Tab", async ({ page }) => {
    test.skip(isMobile(page), "desktop");
    await page.goto("/utbildning/geografi/");
    await page.getByTestId("nav-theme-geografi").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("nav-toggle-geografi")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("nav-toggle-geografi")).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("nav-theme-historia")).toBeFocused();
  });

  test("layout: spalten 260–300 px, små oförvrängda bilder, ingen sidoscroll", async ({ page }) => {
    await page.goto("/utbildning/geografi/");
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
    await page.goto("/utbildning/geografi/");
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

  /* ---------- Navigationen inne i kapitlen ---------- */

  const chapterById = (slug: string) => pilots.find((c) => c.slug === slug)!;

  test("kapitelsida: gemensam navigation, aktivt kapitel med exakt ett aria-current, rätt tema utfällt", async ({ page }) => {
    const c = chapterById("fran-edo-till-meiji");
    await page.goto(`/kapitel/${c.slug}/`);
    await ensureNavVisible(page);
    const nav = page.getByTestId("education-nav");
    await expect(nav.locator("[aria-current='page']")).toHaveCount(1);
    await expect(page.getByTestId(`nav-chapter-${c.id}`)).toHaveAttribute("aria-current", "page");
    const th = page.getByTestId(`nav-theme-${themeOf(c)}`);
    await expect(th).not.toHaveAttribute("aria-current", "page");
    await expect(th).toHaveAttribute("data-contains-active", "true");
    await expect(page.getByTestId(`nav-toggle-${themeOf(c)}`)).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("nav-toggle-geografi")).toHaveAttribute("aria-expanded", "false");
    // fortfarande möjligt att fälla ut och ihop
    await page.getByTestId("nav-toggle-geografi").click();
    await expect(page.getByTestId("nav-toggle-geografi")).toHaveAttribute("aria-expanded", "true");
    await page.getByTestId(`nav-toggle-${themeOf(c)}`).click();
    await expect(page.getByTestId(`nav-toggle-${themeOf(c)}`)).toHaveAttribute("aria-expanded", "false");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("från ett kapitel till ett annat kapitel och till en temaöversikt, utan flera aria-current", async ({ page }) => {
    const a = chapterById("fran-edo-till-meiji");
    const b = chapterById("att-ata-i-japan");
    await page.goto(`/kapitel/${a.slug}/`);
    await ensureNavVisible(page);
    await page.getByTestId(`nav-chapter-${a.id}`).waitFor({ state: "attached" });
    await page.getByTestId(`nav-toggle-${themeOf(b)}`).click();
    await page.getByTestId(`nav-chapter-${b.id}`).click();
    await expect(page).toHaveURL(new RegExp(`/kapitel/${b.slug}/$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(b.title);
    await ensureNavVisible(page);
    await expect(page.getByTestId(`nav-chapter-${b.id}`)).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("education-nav").locator("[aria-current='page']")).toHaveCount(1);
    await expect(page.getByTestId(`nav-toggle-${themeOf(b)}`)).toHaveAttribute("aria-expanded", "true");
    await page.getByTestId("nav-theme-historia").click();
    await expect(page).toHaveURL(/\/utbildning\/historia\/$/);
    await ensureNavVisible(page);
    await expect(page.getByTestId("nav-theme-historia")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("education-nav").locator("[aria-current='page']")).toHaveCount(1);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/kapitel/${b.slug}/$`));
  });

  test("slutfört kapitel har bock i spalten även på kapitelsidan; andra har ingen", async ({ page }) => {
    const c = chapterById("hansyn-i-vardagen");
    await page.goto(`/kapitel/${c.slug}/`);
    await takeQuiz(page, c, 0);
    await page.reload();
    await ensureNavVisible(page);
    await expect(page.getByTestId(`nav-done-${c.id}`)).toContainText("Slutfört");
    await expect(page.locator("[data-testid^='nav-done-']")).toHaveCount(1);
  });

  test("kapitelsidan har läsbar bredd utan horisontell scroll", async ({ page }) => {
    const c = chapterById("att-ata-i-japan");
    await page.goto(`/kapitel/${c.slug}/`);
    await page.waitForLoadState("networkidle");
    const w = await page.locator("article p").first().evaluate((el) => el.getBoundingClientRect().width);
    expect(w).toBeLessThanOrEqual(700);
    expect(w).toBeGreaterThan(isMobile(page) ? 250 : 400);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  /* ---------- Senast valda tema ---------- */

  /** Väntar tills sidan hydrerats och temat sparats, så testet inte lämnar sidan för tidigt. */
  const saved = (page: Page, id: string) => page.waitForFunction((v) => localStorage.getItem("japanresan:v1:last-theme") === v, id);
  const mainMenuUtbildning = (page: Page) => page.getByRole("link", { name: "Utbildning", exact: true });

  test("Utbildning i huvudmenyn öppnar senast besökta tema (temasida och kapitelsida)", async ({ page }) => {
    await page.goto("/utbildning/mat/");
    await saved(page, "mat");
    await page.goto("/");
    await mainMenuUtbildning(page).click();
    await expect(page).toHaveURL(/\/utbildning\/mat\/$/);
    const c = chapterById("hansyn-i-vardagen");
    await page.goto(`/kapitel/${c.slug}/`);
    await saved(page, "seder");
    await mainMenuUtbildning(page).click();
    await expect(page).toHaveURL(/\/utbildning\/seder\/$/);
    // bakåt från den återupptagna sidan går inte i en omdirigeringsloop
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/kapitel/${c.slug}/$`));
  });

  test("uttrycklig temalänk går före sparat tema och sparas därefter", async ({ page }) => {
    await page.goto("/utbildning/mat/");
    await saved(page, "mat");
    await page.goto("/utbildning/historia/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(themes.find((t) => t.id === "historia")!.title);
    await saved(page, "historia");
    await page.goto("/");
    await mainMenuUtbildning(page).click();
    await expect(page).toHaveURL(/\/utbildning\/historia\/$/);
  });

  test("första besök, ogiltigt sparat tema och blockerad lagring ger tema 1 utan fel", async ({ browser }) => {
    for (const setup of [
      "", // inget sparat
      "try{localStorage.setItem('japanresan:v1:last-theme','finns-inte')}catch(e){}",
      "try{localStorage.setItem('japanresan:v1:last-theme','')}catch(e){}",
      "Object.defineProperty(window,'localStorage',{get(){throw new Error('blockerad')}})",
      "Storage.prototype.getItem=()=>{throw new Error('x')};Storage.prototype.setItem=()=>{throw new Error('x')}",
    ]) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      if (setup) await page.addInitScript(setup);
      await page.goto("/utbildning/");
      await expect(page).toHaveURL(/\/utbildning\/geografi\/$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(themes[0].title);
      expect(errors, setup).toEqual([]);
      await ctx.close();
    }
  });

  test("/utbildning/ levereras utan något tema (inget fel tema kan blinka till)", async ({ page }) => {
    const html = await (await page.request.get("/utbildning/")).text();
    expect(html).not.toContain("Tema 1 av 12");
    expect(html).not.toContain(themes[0].description);
    for (const t of themes.slice(1)) expect(html).not.toContain(`Tema ${t.order} av 12`);
  });

  /* ---------- Mobilpanelen ---------- */

  test("mobil, kapitelsida: tangentbord, fokusfälla, Escape och fokus efter sidbyte", async ({ page }) => {
    test.skip(!isMobile(page), "mobil");
    const c = chapterById("fran-edo-till-meiji");
    const other = chapterById("att-ata-i-japan");
    await page.goto(`/kapitel/${c.slug}/`);
    const opener = page.getByTestId("nav-open");
    await expect(opener).toContainText(themes.find((t) => t.id === themeOf(c))!.title);
    await opener.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("education-nav")).toBeVisible();
    await expect(page.getByRole("button", { name: "Stäng", exact: true })).toBeFocused();
    // Tab stannar i panelen
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest("#utbildning-nav"))).toBe(true);
    }
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest("#utbildning-nav"))).toBe(true);
    }
    // Escape stänger utan att navigera; fokus tillbaka på knappen
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("education-nav")).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`/kapitel/${c.slug}/$`));
    // Stängknappen gör likadant
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Stäng", exact: true }).click();
    await expect(opener).toBeFocused();
    // Val: panelen stängs, fokus hamnar på rubriken på nya sidan
    await page.keyboard.press("Enter");
    await page.getByTestId(`nav-toggle-${themeOf(other)}`).click();
    await page.getByTestId(`nav-chapter-${other.id}`).click();
    await expect(page).toHaveURL(new RegExp(`/kapitel/${other.slug}/$`));
    await expect(page.getByTestId("education-nav")).toBeHidden();
    await expect(page.locator("#innehall h1")).toBeFocused();
    await expect(opener).toContainText(themes.find((t) => t.id === themeOf(other))!.title);
  });

  /* ---------- Skalning ---------- */

  test("hela strukturen: 12 teman och 60 kapitel finns i navigationen", async ({ page }) => {
    await page.goto("/utbildning/geografi/");
    await expect(page.locator("[data-testid^='nav-theme-']")).toHaveCount(12);
    await expect(page.locator("[data-testid^='nav-chapter-'], [data-testid^='nav-planned-']")).toHaveCount(60);
  });

  test("låg skärmhöjd: alla poster nås i spalten med egen scroll", async ({ page }) => {
    test.skip(isMobile(page), "desktop");
    await page.setViewportSize({ width: 1280, height: 480 });
    await page.goto("/utbildning/geografi/");
    for (const t of themes) {
      await page.getByTestId(`nav-toggle-${t.id}`).evaluate((el) => el.getAttribute("aria-expanded") === "false" && (el as HTMLElement).click());
    }
    const nav = page.getByTestId("education-nav");
    expect(await nav.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    const items = page.locator("[data-testid^='nav-theme-'], [data-testid^='nav-chapter-'], [data-testid^='nav-planned-']");
    const n = await items.count();
    expect(n).toBe(72);
    for (const i of [0, 5, 20, 40, n - 1]) {
      await items.nth(i).scrollIntoViewIfNeeded();
      await expect(items.nth(i)).toBeInViewport();
    }
    // spalten är begränsad till fönstrets höjd
    expect((await nav.boundingBox())!.height).toBeLessThanOrEqual(480);
  });

  test("långa titlar och sammanfattningar bryts utan horisontell scroll", async ({ page }) => {
    const long = "Hur japanska skolsystemet, arbetslivet och vardagens oskrivna regler påverkar ungdomars möjligheter, fritid, relationer och framtidsval i storstäder såväl som på landsbygden";
    const longWord = "Samhällsvetenskapligtsammansattaordutanmellanslagsomtestarbrytning";
    await page.goto("/utbildning/geografi/");
    await page.waitForLoadState("networkidle");
    await page.evaluate(
      ({ long, longWord }) => {
        document.querySelectorAll("[data-testid^='nav-theme-'], [data-testid^='nav-chapter-'], [data-testid^='nav-planned-']").forEach((el) => {
          el.insertAdjacentText("beforeend", " " + long + " " + longWord);
        });
        document.querySelectorAll("[data-testid^='chapter-card-'] h3, [data-testid^='chapter-card-'] p").forEach((el) => {
          el.insertAdjacentText("beforeend", " " + long + " " + long + " " + longWord);
        });
        const h = document.querySelector("h1");
        h?.insertAdjacentText("beforeend", " " + long + " " + longWord);
      },
      { long, longWord },
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    if (!isMobile(page)) {
      const nav = page.getByTestId("education-nav");
      expect(await nav.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
      expect((await nav.boundingBox())!.width).toBeLessThanOrEqual(300);
    }
    const cards = page.locator("[data-testid^='chapter-card-']");
    const box = await cards.first().boundingBox();
    const vw = page.viewportSize()!.width;
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw);
  });

  test("sidospalten: bara aktivt tema är utfällt vid direktnavigering, och manuella utfällningar består", async ({ page }) => {
    await page.goto("/utbildning/historia/");
    await ensureNavVisible(page);
    await expect(page.locator("[data-testid^='nav-toggle-'][aria-expanded='true']")).toHaveCount(1);
    await expect(page.getByTestId("nav-toggle-historia")).toHaveAttribute("aria-expanded", "true");
    await page.getByTestId("nav-toggle-geografi").click();
    await page.getByTestId("nav-toggle-mat").click();
    await expect(page.locator("[data-testid^='nav-toggle-'][aria-expanded='true']")).toHaveCount(3);
    await page.getByTestId("nav-toggle-mat").click();
    await expect(page.getByTestId("nav-toggle-geografi")).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("nav-toggle-historia")).toHaveAttribute("aria-expanded", "true");
  });
});
