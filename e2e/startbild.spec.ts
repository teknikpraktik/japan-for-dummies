import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "src", "content", rel), "utf8"));
const photos: { id: string; alt: string; caption: string; creator: string; sourceUrl: string; license: { name: string; url: string }; variants: { path: string }[] }[] = read("images.json");
const home: { hero: { imageId: string }; startImages: string[] } = read("home.json");
const pool = new Set(home.startImages);
const byId = (id: string) => photos.find((p) => p.id === id)!;

const shownId = (page: Page) => page.locator("#start-hero").getAttribute("data-start-image");

/** Bild, bildtext, alt-text och kreditering ska höra till samma bild. */
async function expectConsistent(page: Page) {
  const id = (await shownId(page))!;
  expect(pool.has(id), id).toBe(true);
  const p = byId(id);
  await expect(page.locator("#start-hero-caption")).toHaveText(p.caption);
  await expect(page.locator("#start-hero-img")).toHaveAttribute("alt", p.alt);
  const rights = page.getByTestId("photo-rights");
  await expect(rights.locator("[data-testid^='rights-']")).toHaveCount(1);
  await expect(rights.getByTestId(`rights-${id}`)).toContainText(p.creator);
  await expect(rights.getByRole("link", { name: p.license.name })).toHaveAttribute("href", p.license.url);
  await expect(rights.locator(`a[href="${p.sourceUrl}"]`)).toHaveCount(1);
  return id;
}

test.describe("slumpad introduktionsbild på startsidan", () => {
  test("bild, bildtext, alt-text och kreditering hör ihop, och bilden laddas", async ({ page }) => {
    await page.goto("/");
    const id = await expectConsistent(page);
    await page.waitForFunction(() => {
      const i = document.getElementById("start-hero-img") as HTMLImageElement;
      return i.complete && i.naturalWidth > 0;
    });
    // Bara en bildfil från poolen hämtas åt gången: den valda bildens (en storleksvariant)
    expect(byId(id).variants.length).toBeGreaterThan(0);
  });

  test("upprepade sidladdningar ger variation utan direkt upprepning", async ({ page }) => {
    const seen: string[] = [];
    for (let i = 0; i < 14; i++) {
      await page.goto("/");
      seen.push((await shownId(page))!);
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i], `omladdning ${i}: ${seen.join(", ")}`).not.toBe(seen[i - 1]);
    expect(new Set(seen).size, seen.join(", ")).toBeGreaterThanOrEqual(5);
  });

  test("omrenderingar och ändrad fönsterstorlek slumpar inte om bilden", async ({ page }) => {
    await page.goto("/");
    const id = await expectConsistent(page);
    const vp = page.viewportSize()!;
    await page.setViewportSize({ width: vp.width > 700 ? 600 : 1000, height: vp.height });
    await page.setViewportSize(vp);
    // En statusändring i huvudknappen (lokala framsteg) får sidan att rendera om
    await page.evaluate(() => window.dispatchEvent(new StorageEvent("storage", { key: "japanresan:v1:state" })));
    await page.waitForTimeout(500);
    expect(await shownId(page)).toBe(id);
    await expectConsistent(page);
  });

  test("ingen bildändring syns efter första målningen (ingen standardbild som byts ut)", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __srcs: string[] }).__srcs = [];
      new MutationObserver(() => {
        const i = document.getElementById("start-hero-img") as HTMLImageElement | null;
        const w = window as unknown as { __srcs: string[] };
        if (i?.getAttribute("src") && w.__srcs[w.__srcs.length - 1] !== i.getAttribute("src")) w.__srcs.push(i.getAttribute("src")!);
      }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["src"] });
    });
    const requested: string[] = [];
    page.on("request", (r) => {
      if (/\/images\/[^/]+\/.+\.webp$/.test(new URL(r.url()).pathname)) requested.push(new URL(r.url()).pathname);
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const srcs = await page.evaluate(() => (window as unknown as { __srcs: string[] }).__srcs);
    expect(srcs).toHaveLength(1); // src sattes en enda gång
    const id = (await shownId(page))!;
    const heroFiles = requested.filter((u) => u.startsWith(`/images/${id}/`));
    const otherPoolFiles = requested.filter((u) => home.startImages.some((p) => p !== id && u.startsWith(`/images/${p}/`)));
    expect(heroFiles.length, requested.join(", ")).toBeGreaterThanOrEqual(1);
    expect(heroFiles.length).toBeLessThanOrEqual(2); // en storleksvariant, ev. en ny vid högre pixeldensitet
    expect(otherPoolFiles, "andra kandidater ska inte hämtas").toEqual([]);
  });

  test("fungerar när lokal lagring är blockerad", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL });
    await ctx.addInitScript(() => {
      Object.defineProperty(window, "localStorage", { get() { throw new DOMException("blockerad", "SecurityError"); } });
    });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expectConsistent(page);
    await page.waitForFunction(() => (document.getElementById("start-hero-img") as HTMLImageElement).naturalWidth > 0);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test("föregående bild utesluts även efter omstart av webbläsarsessionen (lagrad lokalt)", async ({ page }) => {
    await page.goto("/");
    const first = await shownId(page);
    expect(await page.evaluate(() => localStorage.getItem("japanresan:startbild:v1"))).toBe(first);
    await page.goto("/");
    expect(await shownId(page)).not.toBe(first);
  });

  test("om den valda bilden inte kan laddas visas reservbilden med matchande text och kreditering", async ({ page }) => {
    const fallback = home.hero.imageId;
    await page.route("**/images/**", (route) => {
      const u = new URL(route.request().url()).pathname;
      return u.startsWith(`/images/${fallback}/`) ? route.continue() : route.abort();
    });
    // Tvinga fram att något annat än reservbilden väljs: förhandslagra reservbilden som föregående
    await page.addInitScript((id) => { try { localStorage.setItem("japanresan:startbild:v1", id); } catch { /* */ } }, fallback);
    await page.goto("/");
    await expect.poll(() => shownId(page)).toBe(fallback);
    await expectConsistent(page);
    await page.waitForFunction(() => (document.getElementById("start-hero-img") as HTMLImageElement).naturalWidth > 0);
  });

  test("utan JavaScript visas reservbilden, och kreditering finns", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto("/");
    const fb = byId(home.hero.imageId);
    await expect(page.locator("#start-hero noscript img, #start-hero img[alt]").first()).toHaveAttribute("alt", /.*/);
    await expect(page.locator("#start-hero figcaption")).toHaveText(fb.caption);
    await expect(page.getByTestId(`rights-${fb.id}`)).toContainText(fb.creator);
    await ctx.close();
  });

  test("bildytan har fast proportion och sidan hoppar inte när bilden visas", async ({ page }) => {
    await page.addInitScript(() => {
      let shift = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) shift += e.value; }).observe({ type: "layout-shift", buffered: true });
      (window as unknown as { __cls: () => number }).__cls = () => shift;
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const box = (await page.locator("#start-hero > div").boundingBox())!;
    expect(box.width / box.height).toBeGreaterThan(1.45);
    expect(box.width / box.height).toBeLessThan(1.55); // 3:2
    expect(await page.evaluate(() => (window as unknown as { __cls: () => number }).__cls())).toBeLessThan(0.02);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("mjuk navigering tillbaka till startsidan visar också en bild med matchande text", async ({ page }) => {
    await page.goto("/utbildning/");
    await page.getByRole("link", { name: "Startsida" }).first().click();
    await expect(page.locator("#start-hero")).toBeVisible();
    await expect.poll(() => page.locator("#start-hero").getAttribute("data-ready")).toBe("1");
    await expectConsistent(page);
  });

  test("alla kandidater och bildvarianter finns i offlinelistan", async () => {
    const manifestPath = path.join(process.cwd(), "public", "offline-manifest.json");
    test.skip(!fs.existsSync(manifestPath), "offline-manifest.json skapas av bygget");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { files?: { url?: string; path?: string }[]; urls?: string[] };
    const text = JSON.stringify(manifest);
    for (const id of home.startImages) for (const v of byId(id).variants) expect(text.includes(v.path), v.path).toBe(true);
  });
});
