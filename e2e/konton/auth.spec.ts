import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { loginStudent, loginStudentOk, loginTeacher, SYN } from "../auth-helpers";
import { pilots, takeQuiz, PUBLISHED } from "../helpers";
import { totp } from "../totp";

test.skip(({ isMobile }) => isMobile, "Inloggningsflödena körs på desktop (mobil täcks av layoutkontrollerna i quality.spec)");

const ch = pilots[0];

async function teacherPage(context: BrowserContext): Promise<Page> {
  const p = await context.newPage();
  await loginTeacher(p);
  return p;
}

test.describe("inloggning", () => {
  test("elev: fel kod ger generellt fel, rätt kod ger Min utbildning med alla publicerade kapitel", async ({ page }) => {
    await loginStudent(page, 1, { code: "FELKODFELKOD12" });
    await expect(page.getByTestId("login-error")).toHaveText(/Fel användarnamn eller kod/);
    await page.getByTestId("identity").fill("okantkonto123");
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("login-error")).toHaveText(/Fel användarnamn eller kod/); // samma fel för okänt konto
    await loginStudentOk(page, 1);
    await expect(page.getByRole("heading", { name: /Hej/ })).toBeVisible();
    await expect(page.locator("[data-testid^='chapter-row-']")).toHaveCount(PUBLISHED);
  });

  test("elev kan skriva koden med små bokstäver och bindestreck", async ({ page }) => {
    await loginStudent(page, 2, { code: "syntetisk-elev-02" });
    await expect(page).toHaveURL(/\/min-utbildning\/$/);
  });

  test("elev ser aldrig läraradministrationen, och API:t nekar", async ({ page }) => {
    await loginStudentOk(page, 3);
    await page.goto("/lararen/");
    await expect(page.getByTestId("not-teacher")).toBeVisible();
    const r = await page.request.get("/api/lararen/oversikt/");
    expect(r.status()).toBe(403);
    const r2 = await page.request.post("/api/lararen/elever/", { data: { displayName: "Hack" }, headers: { origin: "http://localhost:4173" } });
    expect(r2.status()).toBe(403);
  });

  test("lärare loggar in med lösenord och TOTP och ser matrisen", async ({ page }) => {
    await loginTeacher(page);
    await expect(page.getByRole("heading", { name: "Läraröversikt" })).toBeVisible();
    await expect(page.getByTestId("matrix")).toBeVisible();
    // Kolumner: en per publicerat kapitel (de kommande räknas inte)
    await expect(page.getByTestId("matrix").locator("thead th")).toHaveCount(1 + PUBLISHED + 2);
  });

  test("registrering finns inte i gränssnittet och publik registrering är stängd", async ({ page }) => {
    await page.goto("/logga-in/");
    await expect(page.getByText(/registrera|skapa konto|sign up/i)).toHaveCount(0);
    const r = await page.request.post("/api/auth/sign-up/email/", { data: { email: "x@example.org", password: "Losenord-12345", name: "X" }, headers: { origin: "http://localhost:4173" } });
    expect(r.status()).toBe(404);
  });
});

test.describe("framsteg och synkning", () => {
  test("elevens avklarade kapitel synkas och syns i lärarens matris (en rad per elev, antal avklarade)", async ({ page, browser }) => {
    await loginStudentOk(page, 5);
    await page.goto(`/kapitel/${ch.slug}/`);
    await page.waitForLoadState("networkidle");
    await takeQuiz(page, ch, 0);
    await expect(page.getByTestId("quiz-result")).toContainText("Klar");
    await page.goto("/min-utbildning/");
    await expect(page.getByTestId("sync-status")).toContainText("Allt är synkat", { timeout: 15_000 });
    await expect(page.getByTestId(`chapter-row-${ch.id}`)).toContainText("Slutfört");

    const tctx = await browser.newContext();
    const tp = await teacherPage(tctx);
    const row = tp.getByTestId("row-Elev 5");
    await expect(row.getByTestId("count")).toHaveText(`1 av ${PUBLISHED}`);
    await expect(row.locator("td[data-status='completed']")).toHaveCount(1);
    await expect(row).toContainText(/\d{4}/); // tidpunkt för senaste synk
    await tctx.close();
  });

  test("avklarat återgår inte till påbörjat: nytt test med tre rätt ändrar inte status", async ({ page }) => {
    await loginStudentOk(page, 6);
    await page.goto(`/kapitel/${ch.slug}/`);
    await page.waitForLoadState("networkidle");
    await takeQuiz(page, ch, 0);
    await page.getByTestId("retry").click();
    for (let i = 0; i < 5; i++) {
      const legend = await page.locator("#test fieldset legend").first().textContent();
      const q = ch.quiz.find((x) => x.prompt === legend)!;
      await page.locator("#test").getByRole("radio", { name: q.options.find((o) => !o.correct)!.text, exact: true }).check();
      await page.getByTestId("answer").click();
      await page.getByTestId("next-question").click();
    }
    await page.goto("/min-utbildning/");
    await expect(page.getByTestId("sync-status")).toContainText("Allt är synkat", { timeout: 15_000 });
    const rows = await (await page.request.get("/api/framsteg/")).json();
    expect(rows.rows.find((r: { chapterId: string }) => r.chapterId === ch.id).status).toBe("completed");
  });

  test("offline-arbete (synk blockeras) köas, synkas senare utan dubbletter", async ({ page, context }) => {
    await loginStudentOk(page, 7);
    let block = true;
    const posted: string[] = [];
    await page.route("**/api/framsteg/sync/**", (route) => {
      if (block) return route.abort("internetdisconnected");
      posted.push(route.request().postData() ?? "");
      return route.continue();
    });
    await page.goto(`/kapitel/${ch.slug}/`);
    await page.waitForLoadState("networkidle");
    await takeQuiz(page, ch, 0);
    await page.goto("/min-utbildning/");
    await expect(page.getByTestId("sync-status")).toContainText(/väntar på synkning/, { timeout: 15_000 });
    expect((await (await page.request.get("/api/framsteg/")).json()).rows).toHaveLength(0);
    block = false;
    await page.getByTestId("sync-now").click();
    await expect(page.getByTestId("sync-status")).toContainText("Allt är synkat", { timeout: 15_000 });
    await page.getByTestId("sync-now").click();
    const rows = (await (await page.request.get("/api/framsteg/")).json()).rows as { chapterId: string; status: string }[];
    expect(rows.filter((r) => r.chapterId === ch.id)).toHaveLength(1);
    expect(rows.find((r) => r.chapterId === ch.id)!.status).toBe("completed");
    void context;
  });

  test("gäst: framsteg utan konto fungerar som förut och importeras aldrig automatiskt vid inloggning", async ({ page }) => {
    await page.goto(`/kapitel/${ch.slug}/`);
    await page.waitForLoadState("networkidle");
    await takeQuiz(page, ch, 0);
    await expect(page.getByTestId("quiz-result")).toContainText("Klar");
    await loginStudentOk(page, 8);
    // Ingenting har importerats automatiskt
    expect((await (await page.request.get("/api/framsteg/")).json()).rows).toHaveLength(0);
    // Förhandsgranskning och uttrycklig bekräftelse krävs
    await expect(page.getByTestId("legacy-panel")).toBeVisible();
    await expect(page.getByTestId("legacy-panel")).toContainText(ch.title);
    await expect(page.getByTestId("legacy-panel")).toContainText(/självrapporterade/);
    expect((await (await page.request.get("/api/framsteg/")).json()).rows).toHaveLength(0);
    await page.getByTestId("legacy-import").click();
    await expect(page.getByTestId("legacy-done")).toBeVisible();
    let rows = (await (await page.request.get("/api/framsteg/")).json()).rows as { source: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("imported");
    // Upprepad import skapar inga dubbletter
    await page.reload();
    await page.getByTestId("legacy-import").click();
    await expect(page.getByTestId("legacy-done")).toBeVisible();
    rows = (await (await page.request.get("/api/framsteg/")).json()).rows as { source: string }[];
    expect(rows).toHaveLength(1);
  });

  test("avböjd import ändrar inget", async ({ page }) => {
    await page.goto(`/kapitel/${ch.slug}/`);
    await page.waitForLoadState("networkidle");
    await takeQuiz(page, ch, 0);
    await loginStudentOk(page, 9);
    await page.getByTestId("legacy-skip").click();
    await expect(page.getByTestId("legacy-panel")).toHaveCount(0);
    expect((await (await page.request.get("/api/framsteg/")).json()).rows).toHaveLength(0);
  });
});

test.describe("delade enheter, utloggning och kontobyte", () => {
  test.use({ serviceWorkers: "block" });

  test("standard: inget personligt i localStorage; utloggning rensar; varning vid osynkade framsteg som kan avbrytas", async ({ page }) => {
    await loginStudentOk(page, 10);
    let block = true;
    await page.route("**/api/framsteg/sync/**", (route) => (block ? route.abort("internetdisconnected") : route.continue()));
    await page.goto(`/kapitel/${ch.slug}/`);
    await page.waitForLoadState("networkidle");
    await takeQuiz(page, ch, 0);
    const keys = async () => page.evaluate(() => ({ local: Object.keys(localStorage).filter((k) => k.startsWith("japanresan:v2:acct:")), session: Object.keys(sessionStorage).filter((k) => k.startsWith("japanresan:v2:acct:")) }));
    const k = await keys();
    expect(k.local).toEqual([]); // standard: delad enhet, inget personligt kvar
    expect(k.session.length).toBeGreaterThan(0);
    // Varna före utloggning, och låt eleven avbryta
    await page.getByTestId("logout").click();
    await expect(page.getByTestId("logout-confirm")).toContainText("Osynkade framsteg");
    await page.getByTestId("logout-cancel").click();
    await expect(page.getByTestId("account-name")).toBeVisible();
    // Logga ut ändå: lokala personliga data rensas och sessionen är avslutad
    await page.getByTestId("logout").click();
    await page.getByTestId("logout-anyway").click();
    await expect(page.getByTestId("login-link")).toBeVisible();
    const after = await keys();
    expect(after.local).toEqual([]);
    expect(after.session).toEqual([]);
    block = false;
    expect(await (await page.request.get("/api/me/")).json()).toEqual({ user: null });
  });

  test("utloggning utan osynkade framsteg sker direkt", async ({ page }) => {
    await loginStudentOk(page, 11);
    await page.getByTestId("logout").click();
    await expect(page.getByTestId("login-link")).toBeVisible();
  });

  test("val att spara på egen enhet: sparas lokalt, och rensas vid utloggning", async ({ page }) => {
    await loginStudentOk(page, 12);
    await page.getByTestId("persist-toggle").check();
    await page.goto(`/kapitel/${ch.slug}/`);
    await page.waitForLoadState("networkidle");
    await takeQuiz(page, ch, 0);
    const local = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("japanresan:v2:acct:")));
    expect(local.some((k) => k.endsWith(":state"))).toBe(true);
    await page.goto("/min-utbildning/");
    await expect(page.getByTestId("sync-status")).toContainText("Allt är synkat", { timeout: 15_000 });
    await page.getByTestId("logout").click();
    await expect(page.getByTestId("login-link")).toBeVisible();
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("japanresan:v2:")))).toEqual([]);
  });

  test("kontobyte på samma enhet läcker varken framsteg eller synkkö", async ({ page, context }) => {
    // Elev A gör framsteg som inte hinner synkas, sedan byts konto utan utloggning (sessionen ersätts).
    await loginStudentOk(page, 13);
    await page.route("**/api/framsteg/sync/**", (route) => route.abort("internetdisconnected"));
    await page.goto(`/kapitel/${ch.slug}/`);
    await page.waitForLoadState("networkidle");
    await takeQuiz(page, ch, 0);
    await page.unroute("**/api/framsteg/sync/**");
    const sent: string[] = [];
    await page.route("**/api/framsteg/sync/**", (route) => {
      sent.push(route.request().postData() ?? "");
      return route.continue();
    });
    await context.clearCookies();
    await loginStudentOk(page, 14);
    await page.goto("/min-utbildning/");
    await expect(page.locator("[data-testid^='chapter-row-']")).toHaveCount(PUBLISHED);
    for (const row of await page.locator("[data-testid^='chapter-row-']").all()) await expect(row).toContainText("Ej påbörjat");
    await page.getByTestId("sync-now").click();
    await page.waitForTimeout(500);
    expect(sent.join("")).not.toContain(ch.id); // A:s köade framsteg skickas aldrig som B
    expect((await (await page.request.get("/api/framsteg/")).json()).rows).toHaveLength(0);
  });
});

test.describe("läraradministration (gränssnitt)", () => {
  test("skapa elev: kortet visar användarnamn och kod en gång; eleven kan logga in; koden finns inte kvar", async ({ page, browser }) => {
    await loginTeacher(page);
    await page.goto("/lararen/elever/");
    await page.getByTestId("student-name").fill("Ellinor");
    await page.getByTestId("create-student").click();
    await expect(page.getByTestId("login-card")).toBeVisible();
    const username = (await page.getByTestId("card-username").textContent())!.trim();
    const code = (await page.getByTestId("card-code").textContent())!.trim();
    expect(username).not.toMatch(/ellinor/i);
    expect(code.replace(/-/g, "")).toHaveLength(14);
    await expect(page.getByTestId("card-print")).toBeVisible();
    await page.getByTestId("card-close").click();
    await expect(page.getByTestId("login-card")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(code);
    await page.reload();
    await expect(page.locator("body")).not.toContainText(code);
    // Eleven loggar in med uppgifterna från kortet
    const ctx = await browser.newContext();
    const sp = await ctx.newPage();
    await sp.goto("/logga-in/");
    await sp.getByTestId("identity").fill(username);
    await sp.getByTestId("secret").fill(code);
    await sp.getByTestId("login-submit").click();
    await expect(sp).toHaveURL(/\/min-utbildning\/$/);
    await expect(sp.getByRole("heading", { name: /Hej Ellinor/ })).toBeVisible();
    await ctx.close();
  });

  test("ny kod kräver lösenordsbekräftelse; gammal kod och gamla sessioner slutar gälla", async ({ page, browser }) => {
    await loginTeacher(page);
    await page.goto("/lararen/elever/");
    await page.getByTestId("student-name").fill("Kodbyte");
    await page.getByTestId("create-student").click();
    const username = (await page.getByTestId("card-username").textContent())!.trim();
    const oldCode = (await page.getByTestId("card-code").textContent())!.trim();
    await page.getByTestId("card-close").click();
    const sctx = await browser.newContext();
    const sp = await sctx.newPage();
    await sp.goto("/logga-in/");
    await sp.getByTestId("identity").fill(username);
    await sp.getByTestId("secret").fill(oldCode);
    await sp.getByTestId("login-submit").click();
    await expect(sp).toHaveURL(/\/min-utbildning\/$/);

    await page.getByTestId("reset-Kodbyte").click();
    // fel lösenord nekas
    await page.getByTestId("confirm-password").fill("fel-losenord-123");
    await page.getByTestId("confirm-submit").click();
    await expect(page.getByTestId("confirm-error")).toBeVisible();
    await page.getByTestId("confirm-password").fill(SYN.teacherPassword);
    await page.getByTestId("confirm-submit").click();
    const newCode = (await page.getByTestId("card-code").textContent())!.trim();
    expect(newCode).not.toBe(oldCode);
    // Elevens gamla session är avslutad
    await sp.reload();
    await expect(sp.getByTestId("needs-login")).toBeVisible();
    // Gammal kod fungerar inte, ny gör det
    await sp.goto("/logga-in/");
    await sp.getByTestId("identity").fill(username);
    await sp.getByTestId("secret").fill(oldCode);
    await sp.getByTestId("login-submit").click();
    await expect(sp.getByTestId("login-error")).toBeVisible();
    await sp.getByTestId("secret").fill(newCode);
    await sp.getByTestId("login-submit").click();
    await expect(sp).toHaveURL(/\/min-utbildning\/$/);
    await sctx.close();
  });

  test("avaktivera elev: inloggning stoppas och befintlig session avslutas", async ({ page, browser }) => {
    await loginTeacher(page);
    await page.goto("/lararen/elever/");
    await page.getByTestId("student-name").fill("Avaktiv");
    await page.getByTestId("create-student").click();
    const username = (await page.getByTestId("card-username").textContent())!.trim();
    const code = (await page.getByTestId("card-code").textContent())!.trim();
    await page.getByTestId("card-close").click();
    const sctx = await browser.newContext();
    const sp = await sctx.newPage();
    await sp.goto("/logga-in/");
    await sp.getByTestId("identity").fill(username);
    await sp.getByTestId("secret").fill(code);
    await sp.getByTestId("login-submit").click();
    await expect(sp).toHaveURL(/\/min-utbildning\/$/);
    await page.getByTestId("member-Avaktiv").getByRole("button", { name: "Avaktivera" }).click();
    await expect(page.getByTestId("admin-notice")).toContainText("avaktiverad");
    await sp.reload();
    await expect(sp.getByTestId("needs-login")).toBeVisible();
    await sp.goto("/logga-in/");
    await sp.getByTestId("identity").fill(username);
    await sp.getByTestId("secret").fill(code);
    await sp.getByTestId("login-submit").click();
    await expect(sp.getByTestId("login-error")).toBeVisible();
    await sctx.close();
  });

  test("radering kräver bekräftelse med namn och lösenord", async ({ page }) => {
    await loginTeacher(page);
    await page.goto("/lararen/elever/");
    await page.getByTestId("student-name").fill("Raderas");
    await page.getByTestId("create-student").click();
    await page.getByTestId("card-close").click();
    await page.getByTestId("member-Raderas").getByRole("button", { name: "Radera" }).click();
    await page.getByTestId("confirm-typed").fill("Fel namn");
    await page.getByTestId("confirm-password").fill(SYN.teacherPassword);
    await page.getByTestId("confirm-submit").click();
    await expect(page.getByTestId("confirm-error")).toContainText("Skriv namnet");
    await page.getByTestId("confirm-typed").fill("Raderas");
    await page.getByTestId("confirm-submit").click();
    await expect(page.getByTestId("admin-notice")).toContainText("raderat");
    await expect(page.getByTestId("member-Raderas")).toHaveCount(0);
  });

  test("ny lärare: engångslänk, eget lösenord, direkt adminåtkomst; tvåfaktor är valfritt", async ({ page, browser }) => {
    await loginTeacher(page);
    await page.goto("/lararen/larare/");
    await page.getByTestId("create-teacher").click();
    await page.getByTestId("teacher-name").fill("Ny Lärare");
    await page.getByTestId("teacher-email").fill("ny.larare.e2e@example.org");
    await page.getByTestId("confirm-password").fill(SYN.teacherPassword);
    await page.getByTestId("confirm-submit").click();
    const url = await page.getByTestId("activation-url").inputValue();
    expect(url).toMatch(/\/aktivera\/[A-Za-z0-9_-]{30,}\/$/);

    const nctx = await browser.newContext();
    const np = await nctx.newPage();
    await np.goto(url);
    await np.getByTestId("pw").fill("Nya-larares-losenord-1");
    await np.getByTestId("pw2").fill("Nya-larares-losenord-1");
    await np.getByTestId("activate-submit").click();
    await expect(np.getByTestId("activated")).toBeVisible();
    // Länken kan inte återanvändas
    await np.goto(url);
    await expect(np.getByText(/ogiltig eller har gått ut/)).toBeVisible();
    // Inloggning med bara lösenord ger administratörsåtkomst direkt
    await np.goto("/logga-in/");
    await np.getByLabel("Lärare").check({ force: true });
    await np.getByTestId("identity").fill("ny.larare.e2e@example.org");
    await np.getByTestId("secret").fill("Nya-larares-losenord-1");
    await np.getByTestId("login-submit").click();
    await expect(np).toHaveURL(/\/lararen\/$/);
    expect((await np.request.get("/api/lararen/oversikt/")).status()).toBe(200);
    await expect(np.getByTestId("enroll-needed")).toHaveCount(0);
    // Frivillig registrering av TOTP via gränssnittet
    await np.goto("/konto/tvafaktor/");
    await np.getByTestId("tf-password").fill("Nya-larares-losenord-1");
    await np.getByTestId("tf-start").click();
    const secret = (await np.getByTestId("tf-secret").textContent())!.trim();
    await expect(np.getByTestId("tf-codes").locator("li")).toHaveCount(10);
    await expect(np.getByTestId("tf-verify")).toBeDisabled(); // koderna måste sparas först
    await np.getByTestId("tf-saved").check();
    await np.getByTestId("tf-code").fill(totp(secret));
    await np.getByTestId("tf-verify").click();
    await expect(np.getByTestId("enrolled")).toBeVisible();
    expect((await np.request.get("/api/lararen/oversikt/")).status()).toBe(200);
    await nctx.close();
  });
});
