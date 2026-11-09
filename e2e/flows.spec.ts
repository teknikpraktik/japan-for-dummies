import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { pilots, takeQuiz, PUBLISHED, PLANNED, PLANNED_SAMPLE } from "./helpers";

const readJson = (rel: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "src", "content", rel), "utf8"));
test.describe("pilotkapitel och direktlänkar", () => {
  for (const c of pilots) {
    test(`direktlänk och genomförande: ${c.slug}`, async ({ page }) => {
      await page.goto(`/kapitel/${c.slug}/`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(c.title);
      // Kapitelposition och väg tillbaka
      await expect(page.getByRole("link", { name: /Till översikten/ }).first()).toBeVisible();
      await expect(page.getByText(/kapitel \d av \d+ i temat|\d+ av 60 totalt/)).toHaveCount(0);
      // Minst en övning finns och kan användas
      await expect(page.getByRole("heading", { name: "Öva" })).toBeVisible();
      // Gör testet med alla rätt
      await takeQuiz(page, c, 0);
      await expect(page.getByTestId("quiz-result")).toContainText("Du fick 5 av 5 rätt");
      await expect(page.getByTestId("quiz-result")).toContainText("Klar");
    });
  }

  test("kapitelstatus och översikt uppdateras", async ({ page }) => {
    await page.goto(`/kapitel/${pilots[0].slug}/`);
    await takeQuiz(page, pilots[0], 0);
    await page.goto("/utbildning/");
    await expect(page.getByText(/Du har klarat \d+ av \d+ kapitel/)).toHaveCount(0);
    await page.goto("/offline/");
    await expect(page.getByTestId("progress-summary")).toHaveText(`1 av ${PUBLISHED} kapitel klara`);
  });

  test("opublicerade kapitel visas som Kommer senare, utan test", async ({ page }) => {
    await page.goto("/utbildning/");
    // Alla planerade kapitel finns kvar i strukturen (vänsterspalten), men som text, inte länkar.
    await expect(page.locator("[data-testid^='nav-planned-']")).toHaveCount(PLANNED);
    await expect(page.locator("[data-testid^='nav-chapter-']")).toHaveCount(PUBLISHED); // publicerade är länkar
    // Vänta tills service workern har tagit över, annars kan den avbryta nästa navigering.
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.goto("/kapitel/skogs-och-hav-finns-inte/");
    await expect(page.getByRole("heading", { name: "Sidan kunde inte hittas" })).toBeVisible();
    if (PLANNED_SAMPLE) {
      await page.goto(`/kapitel/${PLANNED_SAMPLE.slug}/`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(PLANNED_SAMPLE.title);
      await expect(page.getByText("planerat men inte skrivet än")).toBeVisible();
      await expect(page.getByTestId("start-quiz")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Planerade lärandemål" })).toBeVisible();
    }
  });
});

test.describe("poäng, gräns och omförsök", () => {
  const c = pilots[0];
  test("tre rätt är inte Klar, fyra rätt är Klar, omförsök bevarar bästa", async ({ page }) => {
    await page.goto(`/kapitel/${c.slug}/`);
    await takeQuiz(page, c, 2); // 3 rätt
    await expect(page.getByTestId("quiz-result")).toContainText("Du fick 3 av 5 rätt");
    await expect(page.getByTestId("quiz-result")).toContainText("Fyra rätt krävs");
    await page.goto("/offline/");
    await expect(page.getByTestId("progress-summary")).toHaveText(`0 av ${PUBLISHED} kapitel klara`);

    await page.goto(`/kapitel/${c.slug}/`);
    await page.getByTestId("retry").click(); // färdigt test visas igen efter omladdning
    // omförsök: ordningen kan vara annan, helper läser frågan ur legend så det fungerar
    for (let i = 0; i < 5; i++) {
      const legend = await page.locator("#test fieldset legend").first().textContent();
      const q = c.quiz.find((x) => x.prompt === legend)!;
      const opt = q.options.find((o) => Boolean(o.correct) !== (i === 0))!; // 1 fel => 4 rätt
      await page.locator("#test").getByRole("radio", { name: opt.text, exact: true }).check();
      await page.getByTestId("answer").click();
      await page.getByTestId("next-question").click();
    }
    await expect(page.getByTestId("quiz-result")).toContainText("Du fick 4 av 5 rätt");
    await page.getByTestId("retry").click();
    // lämna sista försöket med bara fel -> bästa kvarstår
    for (let i = 0; i < 5; i++) {
      const legend = await page.locator("#test fieldset legend").first().textContent();
      const q = c.quiz.find((x) => x.prompt === legend)!;
      await page.locator("#test").getByRole("radio", { name: q.options.find((o) => !o.correct)!.text, exact: true }).check();
      await page.getByTestId("answer").click();
      await page.getByTestId("next-question").click();
    }
    await expect(page.getByTestId("quiz-result")).toContainText("Du fick 0 av 5 rätt");
    await page.goto("/offline/");
    await expect(page.getByTestId("progress-summary")).toHaveText(`1 av ${PUBLISHED} kapitel klara`);
    await page.getByText("Visa testresultat").click();
    await expect(page.getByRole("row", { name: new RegExp(c.title.slice(0, 20)) })).toContainText("4/5");
  });

  test("framsteg och pågående test finns kvar efter omladdning", async ({ page }) => {
    await page.goto(`/kapitel/${c.slug}/`);
    await page.getByTestId("start-quiz").click();
    for (let i = 0; i < 2; i++) {
      const legend = await page.locator("#test fieldset legend").first().textContent();
      const q = c.quiz.find((x) => x.prompt === legend)!;
      await page.locator("#test").getByRole("radio", { name: q.options.find((o) => o.correct)!.text, exact: true }).check();
      await page.getByTestId("answer").click();
      await page.getByTestId("next-question").click();
    }
    await page.reload();
    await expect(page.getByTestId("quiz-position")).toHaveText("Fråga 3 av 5");
    await page.goto("/utbildning/");
    await page.goto(`/utbildning/${(c as unknown as { themeId: string }).themeId}/`);
    await expect(page.getByTestId(`chapter-card-${c.id}`).getByText(/Påbörjat/)).toBeVisible();
  });

  test("inga favoritknappar, redaktionella rutor eller extra navigering längst ned", async ({ page }) => {
    await page.goto(`/kapitel/${c.slug}/`);
    await expect(page.getByRole("button", { name: /Favorit/ })).toHaveCount(0);
    for (const t of [/innehållsversion/i, /Osäkerhet och begränsningar/, /Kontrollera nära avresa/, /Granskningsstatus/]) await expect(page.getByText(t)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Källor" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bilder och rättigheter" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Kapitelnavigering" }).getByRole("link", { name: "Till översikten" })).toHaveCount(0);
  });

  test("startsidan och sidfoten saknar pilottexten, reseuppgiftsrutan och pilotöversikten", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Piloten har/)).toHaveCount(0);
    for (const t of ["Resmål", "Avresa", "Vad finns i piloten?"]) await expect(page.getByText(t, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Japan börjar här");
  });
});

test.describe("export och import", () => {
  test("export, ogiltig fil, sammanslagning och ersättning med bekräftelse", async ({ page }, testInfo) => {
    const c = pilots[0];
    await page.goto(`/kapitel/${c.slug}/`);
    await takeQuiz(page, c, 0);
    await page.goto("/offline/");
    await page.getByText("Säkerhetskopiera eller flytta framsteg").click();
    await expect(page.getByTestId("last-export")).toHaveCount(0); // ingen "senaste export" före första exporten

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export").click()]);
    const file = testInfo.outputPath("framsteg.json");
    await download.saveAs(file);
    expect(download.suggestedFilename()).toMatch(/^japanresan-framsteg-\d{4}-\d{2}-\d{2}\.json$/);
    const exported = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(exported.dataVersion).toBe(1);
    expect(exported.data.chapters[c.id].best.score).toBe(5);
    await expect(page.getByTestId("last-export")).toBeVisible();

    // Ogiltig fil
    // Filer skickas som minnesbuffertar (Playwright hanterar inte alla tecken i sökvägar, t.ex. å/ä/ö, i den här miljön).
    const asFile = (name: string, content: string | Buffer) => ({ name, mimeType: "application/json", buffer: Buffer.from(content) });
    await page.getByTestId("import-input").setInputFiles(asFile("ogiltig.json", "detta är inte json"));
    await expect(page.getByTestId("transfer-message")).toContainText("inte giltig JSON");
    await expect(page.getByTestId("transfer-message")).toContainText("Inget har ändrats");
    await expect(page.getByTestId("progress-summary")).toHaveText(`1 av ${PUBLISHED} kapitel klara`);

    // Fel struktur
    await page.getByTestId("import-input").setInputFiles(asFile("fel.json", JSON.stringify({ app: "japanresan-2027", dataVersion: 1, exportedAt: "x", data: { chapters: { a: 1 }, favorites: [] } })));
    await expect(page.getByTestId("transfer-message")).toContainText("fel format");

    // Nollställ via ersätt med tom fil, kräver bekräftelse
    await page.getByTestId("import-input").setInputFiles(asFile("tom.json", JSON.stringify({ app: "japanresan-2027", dataVersion: 1, exportedAt: "2026-11-01T00:00:00Z", data: { chapters: {}, favorites: [] } })));
    await page.getByTestId("import-replace").click();
    await expect(page.getByText(/Det går inte att ångra/)).toBeVisible();
    await expect(page.getByTestId("progress-summary")).toHaveText(`1 av ${PUBLISHED} kapitel klara`); // inget ändrat före bekräftelse
    await page.getByTestId("import-replace-confirm").click();
    await expect(page.getByTestId("progress-summary")).toHaveText(`0 av ${PUBLISHED} kapitel klara`);

    // Slå samman den tidigare exporten
    await page.getByTestId("import-input").setInputFiles(asFile("framsteg.json", fs.readFileSync(file)));
    await page.getByTestId("import-merge").click();
    await expect(page.getByTestId("progress-summary")).toHaveText(`1 av ${PUBLISHED} kapitel klara`);
  });
});

test("tangentbord: ordningsövning och navigation utan mus", async ({ page, isMobile }) => {
  test.skip(isMobile, "Tangentbordstest körs på desktop");
  await page.goto("/kapitel/japan-pa-kartan/");
  await page.waitForLoadState("networkidle"); // vänta in hydrering
  // Fokusera första "Flytta ner"-knapp och aktivera med Enter/mellanslag
  const down = page.getByRole("button", { name: /Flytta ner:/ }).first();
  await down.focus();
  const before = await page.locator("ol.space-y-2 li").first().textContent();
  await page.keyboard.press("Enter");
  const after = await page.locator("ol.space-y-2 li").first().textContent();
  expect(after).not.toBe(before);
  await page.getByRole("button", { name: "Kontrollera ordningen" }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("status").first()).toBeVisible();
  // Skip-länk når innehållet
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Hoppa till innehållet" })).toBeFocused();
});

test.describe("bilder", () => {
  for (const c of pilots) {
    test(`bildplatser och bildtexter: ${c.slug}`, async ({ page }) => {
      const full = readJson(`chapters/${fs.readdirSync(path.join(process.cwd(), "src/content/chapters")).find((f) => f.includes(c.slug))!}`);
      await page.goto(`/kapitel/${c.slug}/`);
      await expect(page.getByTestId("photo-placeholder")).toHaveCount(0);
      // Ifylld bildplats: kort bildtext utan attribution; kreditering samlas under Bilder och rättigheter
      const used = new Set<string>([full.hero.imageId, ...full.sections.flatMap((x: { blocks: { type: string; imageId?: string }[] }) => x.blocks).filter((b: { type: string }) => b.type === "photo").map((b: { imageId?: string }) => b.imageId)].filter(Boolean));
      await expect(page.locator("[data-testid^='rights-']")).toHaveCount(used.size);
      const figs = page.locator("figure[data-slot-state]");
      for (let i = 0; i < (await figs.count()); i++) {
        await expect(figs.nth(i).locator("figcaption")).toBeVisible();
        await expect(figs.nth(i).locator("figcaption a")).toHaveCount(0);
        await expect(figs.nth(i).getByTestId("photo-credit")).toHaveCount(0);
        await expect(figs.nth(i).locator("img")).toHaveAttribute("alt", /.*/);
      }
    });
  }

  test("observationsuppgifter finns och påverkar inte poäng eller status", async ({ page }) => {
    await page.goto("/kapitel/fran-edo-till-meiji/");
    const obs = page.getByTestId("observe");
    await expect(obs).toHaveCount(1);
    await expect(obs).not.toContainText("Utan bild");
    await page.goto("/kapitel/hansyn-i-vardagen/");
    await expect(page.getByTestId("observe")).toHaveCount(1);
    await expect(page.getByTestId("observe")).not.toContainText("Utan bild");
    // Chapter is still "not started → started" only by opening, not by the observation task.
    await page.goto("/offline/");
    await expect(page.getByTestId("progress-summary")).toHaveText(`0 av ${PUBLISHED} kapitel klara`);
  });

  test("sidan Bildkällor visar bilder med licens", async ({ page }) => {
    const photos = readJson("images.json");
    await page.goto("/bildkallor/");
    await expect(page.getByRole("heading", { level: 1, name: "Bildkällor" })).toBeVisible();
    for (const p of photos) await expect(page.locator(`#${p.id}`)).toContainText(p.license.name);
    await expect(page.getByText("Kodens licens omfattar inte fotografierna")).toBeVisible();
  });
});
