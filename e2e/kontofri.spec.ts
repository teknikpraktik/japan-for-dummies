import { expect, test, type Page } from "@playwright/test";
import { pilots, takeQuiz } from "./helpers";

/** Kontofritt läge (standard): ingen inloggning, inga serveranrop om framsteg, allt sparas lokalt. */
const chapter = pilots.find((c) => c.slug === "arstider-och-klimat")!;

function trackApi(page: Page) {
  const calls: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (/^\/api(\/|$)/.test(u.pathname)) calls.push(`${r.method()} ${u.pathname}`);
  });
  return calls;
}

test.describe("kontofri tjänst", () => {
  test("primär navigation är bara Startsida och Utbildning; inga konto- eller lärarlänkar någonstans", async ({ page, isMobile }) => {
    await page.goto("/");
    const main = isMobile ? page.getByRole("navigation", { name: "Snabbmeny" }) : page.getByRole("navigation", { name: "Huvudmeny" });
    await expect(main.getByRole("link")).toHaveText([/Startsida$/, /Utbildning$/]);
    await expect(page.getByTestId("offline-link")).toBeVisible();
    for (const t of [/Logga in/, /Logga ut/, /Konto/, /Lärare/, /Resepass/, /Min sida/]) await expect(page.getByRole("link", { name: t }), String(t)).toHaveCount(0);
    for (const url of ["/", "/utbildning/geografi/", `/kapitel/${chapter.slug}/`, "/offline/", "/integritet/"]) {
      await page.goto(url);
      const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
      expect(hrefs.filter((h) => /^\/(logga-in|min-utbildning|lararen|konto|aktivera|api|resepass|info)(\/|$)/.test(h)), url).toEqual([]);
    }
    const footer = page.getByRole("contentinfo").getByRole("link");
    await expect(footer).toHaveText(["Integritet", "Källor", "Bilder och rättigheter", "Offline och framsteg"]);
  });

  test("konto-, aktiverings-, inloggnings- och lärarsidor samt API ger 404, även med en gammal sessionskaka, och sätter inga kakor", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "better-auth.session_token", value: "gammal.session", url: baseURL! }]);
    const pages = ["/logga-in/", "/min-utbildning/", "/lararen/", "/lararen/elever/", "/lararen/larare/", "/konto/", "/konto/tvafaktor/", "/aktivera/abc/"];
    for (const p of pages) {
      const res = await page.request.get(p);
      expect(res.status(), p).toBe(404);
      expect(res.headers()["set-cookie"], p).toBeUndefined();
    }
    const apis: [string, string][] = [
      ["GET", "/api/me/"], ["GET", "/api/me"], ["GET", "/api/framsteg/"], ["POST", "/api/framsteg/sync/"], ["POST", "/api/framsteg/importera/"],
      ["GET", "/api/lararen/oversikt/"], ["GET", "/api/lararen/medlemmar/"], ["POST", "/api/lararen/elever/"], ["POST", "/api/lararen/larare/"],
      ["POST", "/api/aktivera/abc/"], ["GET", "/api/auth/get-session"], ["POST", "/api/auth/sign-in/email"], ["POST", "/api/auth/sign-in/username"], ["POST", "/api/auth/sign-up/email"], ["POST", "/api/auth/sign-out"],
    ];
    for (const [m, u] of apis) {
      const res = await page.request.fetch(u, { method: m, headers: { origin: baseURL!, "content-type": "application/json" }, data: m === "POST" ? "{}" : undefined });
      expect(res.status(), `${m} ${u}`).toBe(404);
      expect(res.headers()["set-cookie"], `${m} ${u}`).toBeUndefined();
    }
    // Gamla adresser från Resepass och Info leder till den nya sidan
    await page.goto("/resepass/");
    await expect(page).toHaveURL(/\/offline\/$/);
    await page.goto("/info/");
    await expect(page).toHaveURL(/\/offline\/$/);
  });

  test("lokal progression: kapitel, bock och översikt efter omladdning; inga anrop till servern; inga kakor", async ({ page, context }) => {
    const calls = trackApi(page);
    await page.goto(`/kapitel/${chapter.slug}/`);
    await takeQuiz(page, chapter, 0);
    await page.reload();
    await page.waitForLoadState("networkidle");
    // grön bock (med text) i vänsternavigationen och i temakortet på startsidan
    if (!(await page.getByTestId("education-nav").isVisible())) await page.getByTestId("nav-open").click();
    await expect(page.getByTestId(`nav-done-${chapter.id}`)).toContainText("Slutfört");
    await page.goto("/");
    await expect(page.getByTestId("theme-card-geografi")).toContainText("1 av");
    await page.goto("/offline/");
    await expect(page.getByTestId("stat-completed")).toHaveText(/^1 \//);
    await expect(page.getByTestId("local-notice")).toContainText("Dina framsteg sparas i den här webbläsaren");
    expect(calls).toEqual([]);
    expect(await context.cookies()).toEqual([]);
    // inget i localStorage hör till konton
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys.filter((k) => k.startsWith("japanresan:v2:"))).toEqual([]);
    expect(keys).toContain("japanresan:v1:state");
  });

  test("senast valt tema sparas lokalt och återupptas", async ({ page }) => {
    await page.goto("/utbildning/historia/");
    await page.waitForFunction(() => localStorage.getItem("japanresan:v1:last-theme") === "historia");
    await page.goto("/utbildning/");
    await expect(page).toHaveURL(/\/utbildning\/historia\/$/);
  });

  test("kompatibla gästframsteg bevaras, och kvarglömda kontokopplade uppgifter rensas", async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("japanresan:v2:acct:gammal:state", JSON.stringify({ chapters: { "t01-k01": { completedAt: "2026-01-01T00:00:00.000Z" } } }));
      localStorage.setItem("japanresan:v2:last-acct", JSON.stringify({ id: "gammal", displayName: "Någon" }));
      localStorage.setItem(
        "japanresan:v1:state",
        JSON.stringify({ version: 1, chapters: { "t01-k01": { startedAt: "2026-01-01T00:00:00.000Z", contentVersion: 1, best: { score: 5, at: "2026-01-01T00:00:00.000Z" }, last: { score: 5, at: "2026-01-01T00:00:00.000Z" }, completedAt: "2026-01-01T00:00:00.000Z" } }, favorites: [], drafts: {} }),
      );
    });
    await page.goto("/offline/");
    await expect(page.getByTestId("stat-completed")).toHaveText(/^1 \//);
    await page.waitForFunction(() => !Object.keys(localStorage).some((k) => k.startsWith("japanresan:v2:")));
    expect(await page.evaluate(() => localStorage.getItem("japanresan:v1:state"))).toContain("t01-k01");
  });

  test("rensa lokala framsteg kräver bekräftelse och tar bort framstegen", async ({ page }) => {
    await page.goto(`/kapitel/${chapter.slug}/`);
    await takeQuiz(page, chapter, 0);
    await page.goto("/offline/");
    await expect(page.getByTestId("stat-completed")).toHaveText(/^1 \//);
    await page.getByTestId("clear-start").click();
    await page.getByRole("button", { name: "Avbryt" }).click();
    await expect(page.getByTestId("stat-completed")).toHaveText(/^1 \//);
    await page.getByTestId("clear-start").click();
    await page.getByTestId("clear-confirm").click();
    await expect(page.getByTestId("cleared")).toBeVisible();
    await expect(page.getByTestId("stat-completed")).toHaveText(/^0 \//);
  });

  test("blockerad lokal lagring: utbildningen fungerar och en varning visas", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", { get() { throw new Error("blockerad"); } });
    });
    await page.goto("/utbildning/");
    await expect(page).toHaveURL(/\/utbildning\/geografi\/$/);
    await page.getByTestId(`chapter-card-${chapter.id}`).getByRole("link", { name: chapter.title }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(chapter.title);
    await expect(page.getByRole("alert").filter({ hasText: "lokal lagring" })).toBeVisible();
    await page.goto("/offline/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Offline och framsteg");
    expect(errors).toEqual([]);
  });

  test("integritetssidan beskriver den kontofria tjänsten", async ({ page }) => {
    await page.goto("/integritet/");
    const text = await page.locator("main").innerText();
    expect(text).toContain("Du behöver inget konto");
    expect(text).toContain("Per Björkman");
    expect(text).toMatch(/Vercel/);
    for (const t of [/TOTP/i, /tvåfaktor/i, /lärare/i, /Ej fastställt av skolan/, /@gmail/]) expect(text, String(t)).not.toMatch(t);
  });
});
