import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { pilots, takeQuiz, UPCOMING_THEME } from "./helpers";

const readJson = (rel: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "src", "content", rel), "utf8"));

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
  test("primär navigation är Startsida, Utbildning och Mina framsteg med samma form och markering; inga konto- eller lärarlänkar någonstans", async ({ page, isMobile }) => {
    await page.goto("/");
    const main = isMobile ? page.getByRole("navigation", { name: "Snabbmeny" }) : page.getByRole("navigation", { name: "Huvudmeny" });
    await expect(main.getByRole("link")).toHaveText([/Startsida$/, /^\W*Utbildning$/, /Mina framsteg$/]);
    // Sidhuvudet visar aldrig offline- eller uppdateringsstatus
    await expect(page.getByRole("banner")).not.toContainText(/offline|uppdater|ny version|✓/i);
    for (const t of [/Logga in/, /Logga ut/, /Konto/, /Lärare/, /Resepass/, /Min sida/]) await expect(page.getByRole("link", { name: t }), String(t)).toHaveCount(0);
    for (const url of ["/", "/utbildning/geografi/", `/kapitel/${chapter.slug}/`, "/offline/", "/integritet/"]) {
      await page.goto(url);
      const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
      expect(hrefs.filter((h) => /^\/(logga-in|min-utbildning|lararen|konto|aktivera|api|resepass|info)(\/|$)/.test(h)), url).toEqual([]);
    }
    const footer = page.getByRole("contentinfo").getByRole("link");
    await expect(footer).toHaveText(["Integritet", "Källor", "Bilder och rättigheter", "Mina framsteg"]);
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
    await expect(page.getByTestId("theme-card-geografi")).toContainText(/\d+ kapitel · 1 slutfört/);
    await page.goto("/offline/");
    await expect(page.getByTestId("progress-summary")).toHaveText(/^1 av /);
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
    await expect(page.getByTestId("progress-summary")).toHaveText(/^1 av /);
    await page.waitForFunction(() => !Object.keys(localStorage).some((k) => k.startsWith("japanresan:v2:")));
    expect(await page.evaluate(() => localStorage.getItem("japanresan:v1:state"))).toContain("t01-k01");
  });

  test("rensa lokala framsteg kräver bekräftelse och tar bort framstegen", async ({ page }) => {
    await page.goto(`/kapitel/${chapter.slug}/`);
    await takeQuiz(page, chapter, 0);
    await page.goto("/offline/");
    await expect(page.getByTestId("progress-summary")).toHaveText(/^1 av /);
    await page.getByText("Hantera lagring").click();
    await page.getByTestId("clear-start").click();
    await page.getByRole("button", { name: "Avbryt" }).click();
    await expect(page.getByTestId("progress-summary")).toHaveText(/^1 av /);
    await page.getByTestId("clear-start").click();
    await page.getByTestId("clear-confirm").click();
    await expect(page.getByTestId("cleared")).toBeVisible();
    await expect(page.getByTestId("progress-summary")).toHaveText(/^0 av /);
    await expect(page.getByTestId("offline-remove")).toHaveCount(0);
    await expect(page.getByText("Inget offlinematerial är nedladdat.")).toBeVisible();
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
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mina framsteg");
    expect(errors).toEqual([]);
  });

  test("integritetssidan beskriver den kontofria tjänsten", async ({ page }) => {
    await page.goto("/integritet/");
    const text = await page.locator("main").innerText();
    expect(text).toContain("Du använder utbildningen utan konto");
    for (const h of ["Det som sparas på din enhet", "Utbildningen offline", "Säkerhetskopiera och flytta framsteg", "Radera lokala uppgifter", "Teknisk drift och kakor"]) {
      await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Vercels integritetsinformation" })).toHaveAttribute("href", "https://vercel.com/legal/privacy-policy");
    await expect(page.getByRole("link", { name: "Mina framsteg" }).first()).toHaveAttribute("href", "/offline/");
    for (const t of [/TOTP/i, /tvåfaktor/i, /lärare/i, /Ej fastställt av skolan/, /@gmail/, /Min utbildning/, /Offline och framsteg/]) expect(text, String(t)).not.toMatch(t);
  });

  test("temakort: tillgängligt innehåll och slutförda hålls isär; kommande teman är märkta och går att öppna", async ({ page }) => {
    await page.goto("/");
    const geo = page.getByTestId("theme-card-count-geografi");
    await expect(geo).toHaveText(/^\d+ kapitel · 0 slutförda$/);
    // singular/plural: ett tema med exakt ett tillgängligt kapitel säger "kapitel tillgängligt". Det kan saknas när alla teman
    // har flera publicerade kapitel, så testet kräver bara att varje räknartext har en av de två formerna.
    const counts = await page.locator("[data-testid^='theme-card-count-']").allTextContents();
    expect(counts.length).toBeGreaterThan(0);
    for (const t of counts) expect(t).toMatch(/^\d+ kapitel · \d+ slutförda$/);
    // kommande tema: etikett, ingen framstegsindikator, men öppningsbart med kapitelöversikt
    if (UPCOMING_THEME) {
      const upcoming = page.getByTestId(`theme-card-${UPCOMING_THEME}`);
      await expect(upcoming).toContainText("Kommer senare");
      await expect(upcoming.getByRole("progressbar")).toHaveCount(0);
      await upcoming.getByRole("link").click();
      await expect(page).toHaveURL(new RegExp(`/utbildning/${UPCOMING_THEME}/$`));
      await expect(page.locator("[data-testid^='chapter-card-']").first()).toBeVisible();
    }
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
    // Introduktionsbilden slumpas: bildtexten ska vara den visade bildens korta text, och krediteringen ska vara kompakt.
    const shownId = (await page.locator("#start-hero").getAttribute("data-start-image"))!;
    const shown = readJson("images.json").find((p: { id: string }) => p.id === shownId);
    await expect(page.locator("figure figcaption").first()).toHaveText(shown.caption);
    const rights = page.getByTestId("photo-rights");
    await expect(rights).not.toContainText(shown.caption);
    await expect(rights.getByRole("link", { name: "Wikimedia Commons" })).toBeVisible();
    await expect(rights.getByRole("link", { name: shown.license.name })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("introduktionsbilden är bredare på desktop utan att trycka undan texten, och följer skärmbredden på mobil", async ({ page, isMobile }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const fig = (await page.locator("figure").first().boundingBox())!;
    const text = (await page.locator("h1").boundingBox())!;
    const vw = page.viewportSize()!.width;
    if (isMobile) {
      expect(fig.width).toBeLessThanOrEqual(vw);
      expect(fig.width).toBeGreaterThan(vw - 64);
    } else {
      expect(fig.width).toBeGreaterThanOrEqual(370);
      expect(fig.width).toBeLessThanOrEqual(400);
      expect(text.width).toBeGreaterThan(480);
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

  test("Mina framsteg: aktiv menymarkering (samma som övriga), dokumenttitel och inga statusmärken i menyn", async ({ page, isMobile }) => {
    await page.goto("/offline/");
    await expect(page).toHaveTitle("Mina framsteg – Japan for Dummies");
    const nav = isMobile ? page.getByRole("navigation", { name: "Snabbmeny" }) : page.getByRole("navigation", { name: "Huvudmeny" });
    const mine = nav.getByRole("link", { name: /Mina framsteg/ });
    await expect(mine).toHaveAttribute("aria-current", "page");
    await expect(nav.locator("[aria-current='page']")).toHaveCount(1);
    await expect(mine).toHaveText(/Mina framsteg$/);
    await page.goto("/");
    await expect(nav.getByRole("link", { name: /Mina framsteg/ })).not.toHaveAttribute("aria-current", "page");
    // Inga gamla benämningar i användarsynliga texter
    for (const url of ["/", "/utbildning/geografi/", `/kapitel/${chapter.slug}/`, "/offline/", "/integritet/", "/kallor/", "/bildkallor/"]) {
      await page.goto(url);
      const visible = await page.locator("body").innerText();
      expect(visible, url).not.toMatch(/Min utbildning|Offline och framsteg|Resepass/);
      const names = await page.locator("[aria-label]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
      expect(names.join(" | "), url).not.toMatch(/Min utbildning|Offline och framsteg|Resepass/);
    }
    await page.goto("/");
    // samma typografi, höjd och form som övriga menyval
    const style = (l: ReturnType<typeof nav.getByRole>) => l.evaluate((el) => { const s = getComputedStyle(el); return { font: s.fontWeight + s.fontSize, h: Math.round(el.getBoundingClientRect().height), r: s.borderRadius }; });
    const a = await style(nav.getByRole("link", { name: /Utbildning$/ }).first());
    const b = await style(nav.getByRole("link", { name: /Mina framsteg/ }));
    expect(b).toEqual(a);
  });

  test("Mina framsteg, första besöket: sammanfattning, bara teman med innehåll, inga tomma resultat", async ({ page }) => {
    await page.goto("/offline/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mina framsteg");
    await expect(page.getByText("Här ser du dina framsteg och fortsätter där du slutade.")).toBeVisible();
    await expect(page.getByTestId("progress-summary")).toHaveText(`0 av ${pilots.length} tillgängliga kapitel klara`);
    await expect(page.getByRole("progressbar", { name: "Klara kapitel", exact: true })).toBeVisible();
    // Ingen ruta för nästa kapitel eller fortsättning
    const summary = (await page.getByTestId("progress-summary").boundingBox())!;
    await expect(page.getByTestId("next-step")).toHaveCount(0);
    await expect(page.getByTestId("continue")).toHaveCount(0);
    // Bara teman med publicerade kapitel, utan ”Kommer senare”; även orörda teman visas
    const themesWithContent = new Set(pilots.map((c) => (c as unknown as { themeId: string }).themeId));
    await expect(page.locator("[data-testid^='progress-theme-']")).toHaveCount(themesWithContent.size);
    await expect(page.getByText("Kommer senare")).toHaveCount(0);
    await expect(page.getByText(/färdiga klara/)).toHaveCount(0);
    // Inga testresultat: avsnittet utelämnas. Ingen stor ruta för antal påbörjade.
    await expect(page.getByTestId("results")).toHaveCount(0);
    await expect(page.getByText("påbörjade, inte klara")).toHaveCount(0);
    // Offlinesektion och verktyg ligger längre ned, hopfällda
    const offline = (await page.locator("#offline").boundingBox())!;
    expect(offline.y).toBeGreaterThan(summary.y);
    for (const name of ["Installera som app", "Säkerhetskopiera eller flytta framsteg", "Hantera lagring"]) {
      const d = page.locator("details.tool", { hasText: name }).first();
      if ((await d.count()) === 0) continue; // t.ex. installationsavsnittet döljs i installerad app
      await expect(d).not.toHaveAttribute("open", "");
    }
    await expect(page.getByTestId("local-notice")).toHaveText("Dina framsteg sparas i den här webbläsaren. Exportera dem om du vill spara en kopia eller flytta dem till en annan enhet.");
    await expect(page.getByText("Uppdateringar", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/filer|bildfiler/)).toHaveCount(0);
  });

  test("Mina framsteg, delvis genomförd: per tema och hopfällbara testresultat utan kolumnen Senaste", async ({ page }) => {
    await page.goto(`/kapitel/${chapter.slug}/`);
    await takeQuiz(page, chapter, 0);
    await page.goto("/offline/");
    await expect(page.getByTestId("progress-summary")).toHaveText(`1 av ${pilots.length} tillgängliga kapitel klara`);
    await expect(page.getByTestId("next-step")).toHaveCount(0);
    await expect(page.getByTestId("progress-theme-geografi")).toContainText(/1 av \d+ klara/);
    const results = page.getByTestId("results");
    await expect(results).not.toHaveAttribute("open", "");
    await results.getByText("Visa testresultat").click();
    await expect(results.getByRole("row")).toHaveCount(2); // rubrik + det enda kapitlet med resultat
    await expect(results.getByRole("columnheader")).toHaveText(["Kapitel", "Status", "Bästa"]);
    await expect(results).toContainText("✓ Slutfört");
    await expect(results).toContainText("5/5");
    await expect(results).not.toContainText("Senaste");
    // Tangentbord: sammanfattningen öppnas med Enter
    await results.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(results).not.toHaveAttribute("open", "");
    // Den lagrade informationen om senaste resultat finns kvar
    const last = await page.evaluate((id) => JSON.parse(localStorage.getItem("japanresan:v1:state")!).chapters[id].last?.score, chapter.id);
    expect(last).toBe(5);
  });

  test("Mina framsteg, allt klart: alla kapitel räknas som klara", async ({ page }) => {
    const done = Object.fromEntries(
      pilots.map((c) => [c.id, { startedAt: "2026-01-01T00:00:00.000Z", contentVersion: (c as unknown as { contentVersion: number }).contentVersion, best: { score: 5, at: "2026-01-01T00:00:00.000Z" }, last: { score: 5, at: "2026-01-01T00:00:00.000Z" }, completedAt: "2026-01-01T00:00:00.000Z" }]),
    );
    await page.addInitScript((chapters) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("japanresan:v1:state", JSON.stringify({ version: 1, chapters, favorites: [], drafts: {} }));
    }, done);
    await page.goto("/offline/");
    await expect(page.getByTestId("progress-summary")).toHaveText(`${pilots.length} av ${pilots.length} tillgängliga kapitel klara`);
    await expect(page.getByTestId("next-step")).toHaveCount(0);
    await page.getByTestId("results").getByText("Visa testresultat").click();
    await expect(page.getByTestId("results").getByRole("row")).toHaveCount(pilots.length + 1);
  });

  test("Mina framsteg: verktygen går att använda med tangentbord, och installationsavsnittet har ett tydligt namn", async ({ page }) => {
    await page.goto("/offline/");
    const summary = page.locator("details.tool > summary", { hasText: "Säkerhetskopiera eller flytta framsteg" });
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("export")).toBeVisible();
    await expect(page.getByTestId("last-export")).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("export")).toBeHidden();
    await expect(page.locator("details.tool > summary", { hasText: "Hantera lagring" })).toBeVisible();
  });
});
