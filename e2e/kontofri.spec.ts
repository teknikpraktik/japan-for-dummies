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
    await expect(page.getByTestId("theme-card-geografi")).toContainText(/kapitel tillgängliga · 1 slutfört/);
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

  test("huvudknappen: första besöket, återbesök med påbörjat kapitel, reserv och ogiltiga värden", async ({ page }) => {
    const cta = page.getByTestId("start-cta");
    // Första besöket
    await page.goto("/");
    await expect(cta).toHaveText("Börja utbildningen");
    await expect(cta).toHaveAttribute("href", /\/utbildning\/geografi\/$/);
    await expect(page.getByTestId("start-cta-chapter")).toHaveCount(0);
    // Påbörjat kapitel ger ”Fortsätt” med kapitlet och dess titel
    await page.goto(`/kapitel/${chapter.slug}/`);
    await page.waitForFunction((id) => localStorage.getItem("japanresan:v1:last-chapter") === id, chapter.id);
    await page.goto("/");
    await expect(cta).toHaveText("Fortsätt utbildningen");
    await expect(cta).toHaveAttribute("href", new RegExp(`/kapitel/${chapter.slug}/$`));
    await expect(page.getByTestId("start-cta-chapter")).toHaveText(`Fortsätt med: ${chapter.title}`);
    // Slutfört kapitel är inte längre ”påbörjat”: reserv är senast valda tema
    await page.goto(`/kapitel/${chapter.slug}/`);
    await takeQuiz(page, chapter, 0);
    await page.goto("/");
    await expect(cta).toHaveText("Fortsätt utbildningen");
    await expect(cta).toHaveAttribute("href", /\/utbildning\/geografi\/$/);
    await expect(page.getByTestId("start-cta-chapter")).toHaveCount(0);
    // Ogiltigt sparat kapitel och tema ignoreras utan fel
    await page.evaluate(() => {
      localStorage.setItem("japanresan:v1:last-chapter", "finns-inte");
      localStorage.setItem("japanresan:v1:last-theme", "finns-inte");
    });
    await page.reload();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", /\/utbildning\/geografi\/$/);
  });

  test("huvudknappen byter inte text under laddning (osynlig tills lokal lagring lästs)", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("japanresan:v1:last-theme", "historia"));
    const texts: string[] = [];
    await page.exposeFunction("__cta", (t: string) => texts.push(t));
    await page.addInitScript(() => {
      new MutationObserver(() => {
        const el = document.querySelector("[data-testid=start-cta]");
        if (el) (window as unknown as { __cta: (t: string) => void }).__cta(el.textContent ?? "");
      }).observe(document, { childList: true, subtree: true, characterData: true });
    });
    await page.goto("/");
    await expect(page.getByTestId("start-cta")).toHaveText("Fortsätt utbildningen");
    expect(new Set(texts)).toEqual(new Set(["Fortsätt utbildningen"]));
  });

  test("temakort: tillgängligt innehåll och slutförda hålls isär; kommande teman är märkta och går att öppna", async ({ page }) => {
    await page.goto("/");
    const geo = page.getByTestId("theme-card-count-geografi");
    await expect(geo).toHaveText(/^\d+ kapitel tillgängliga · 0 slutförda$/);
    // singular: ett tema med exakt ett tillgängligt kapitel
    const singular = page.locator("[data-testid^='theme-card-count-']", { hasText: /^1 kapitel tillgängligt · 0 slutförda$/ });
    expect(await singular.count()).toBeGreaterThan(0);
    // kommande tema: etikett, ingen framstegsindikator, men öppningsbart med kapitelöversikt
    const upcoming = page.getByTestId("theme-card-religion");
    await expect(upcoming).toContainText("Kommer senare");
    await expect(upcoming.getByRole("progressbar")).toHaveCount(0);
    await upcoming.getByRole("link").click();
    await expect(page).toHaveURL(/\/utbildning\/religion\/$/);
    await expect(page.locator("[data-testid^='chapter-card-']").first()).toBeVisible();
  });

  test("kapitelkort: ingen ”Ej påbörjad”; Påbörjat och Slutfört med symbol och text", async ({ page }) => {
    await page.goto(`/utbildning/${(chapter as unknown as { themeId: string }).themeId}/`);
    await expect(page.getByText("Ej påbörjad")).toHaveCount(0);
    await expect(page.getByTestId(`chapter-card-${chapter.id}`).getByTestId(/^status-/)).toHaveCount(0);
    await page.goto(`/kapitel/${chapter.slug}/`);
    await page.waitForFunction((id) => JSON.parse(localStorage.getItem("japanresan:v1:state") ?? "{}").chapters?.[id], chapter.id);
    await page.goto(`/utbildning/${(chapter as unknown as { themeId: string }).themeId}/`);
    await expect(page.getByTestId(`chapter-card-${chapter.id}`).getByTestId("status-started")).toHaveText(/◐ Påbörjat/);
    await page.goto(`/kapitel/${chapter.slug}/`);
    await takeQuiz(page, chapter, 0);
    await page.goto(`/utbildning/${(chapter as unknown as { themeId: string }).themeId}/`);
    await expect(page.getByTestId(`chapter-card-${chapter.id}`).getByTestId("status-completed")).toHaveText(/✓ Slutfört/);
  });

  test("startsidan: tre kompakta steg, kort bildtext och kompakt kreditering utan upprepad motivbeskrivning", async ({ page }) => {
    await page.goto("/");
    const steps = page.locator("section[aria-labelledby=sa-funkar] li");
    await expect(steps).toHaveCount(3);
    await expect(steps).toHaveText([/Välj tema/, /Läs och öva/, /Testa dig/]);
    await expect(page.locator("figure figcaption").first()).toHaveText("Anbo på ön Yakushima i södra Japan. Bebyggelsen ligger längs vattnet, med öns skogsklädda berg i bakgrunden.");
    const rights = page.getByTestId("photo-rights");
    await expect(rights).not.toContainText("Anbo på ön Yakushima");
    await expect(rights.getByRole("link", { name: "Wikimedia Commons" })).toBeVisible();
    await expect(rights.getByRole("link", { name: /CC0/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("introduktionsbilden är bredare på desktop utan att trycka undan texten, och följer skärmbredden på mobil", async ({ page, isMobile }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const fig = (await page.locator("figure").first().boundingBox())!;
    const text = (await page.locator("h1").boundingBox())!;
    const cta = (await page.getByTestId("start-cta").boundingBox())!;
    const vw = page.viewportSize()!.width;
    if (isMobile) {
      expect(fig.width).toBeLessThanOrEqual(vw);
      expect(fig.width).toBeGreaterThan(vw - 64);
    } else {
      expect(fig.width).toBeGreaterThanOrEqual(370);
      expect(fig.width).toBeLessThanOrEqual(400);
      expect(text.width).toBeGreaterThan(480);
      expect(cta.x + cta.width).toBeLessThanOrEqual(fig.x);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await expect(page.getByTestId("offline-intro")).toHaveCount(0);
    await expect(page.getByText("Mer om offline")).toHaveCount(0);
  });

  test("temakort: markering uttrycker bara hover eller tangentbordsfokus, och försvinner när musen lämnar", async ({ page, isMobile }) => {
    test.skip(isMobile, "hover och tangentbord testas på desktop");
    await page.goto("/");
    const card = page.getByTestId("theme-card-geografi");
    const other = page.getByTestId("theme-card-historia");
    const style = (l: typeof card) => l.evaluate((el) => { const s = getComputedStyle(el); return { border: s.borderTopColor, bg: s.backgroundColor, outline: s.outlineStyle }; });
    const rest = await style(card);
    expect(await style(other)).toEqual(rest); // jämförbara kort ser likadana ut i grundläget
    await card.hover();
    const hover = await style(card);
    expect(hover.border).not.toBe(rest.border);
    expect(await style(other)).toEqual(rest);
    await page.mouse.move(2, 2);
    expect(await style(card)).toEqual(rest);
    await page.keyboard.press("Tab");
    await card.getByRole("link").focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const focused = await style(card);
    expect(focused.outline).toBe("solid");
  });
});
