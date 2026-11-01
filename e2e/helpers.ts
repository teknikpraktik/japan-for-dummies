import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

export interface Opt { id: string; text: string; correct?: boolean; feedback: string }
export interface Chapter {
  id: string; slug: string; title: string; status: string; order: number;
  quiz: { id: string; prompt: string; options: Opt[] }[];
  exercises: { id: string; type: string; title: string }[];
}

const dir = path.join(process.cwd(), "src", "content", "chapters");
export const pilots: Chapter[] = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Chapter)
  .sort((a, b) => a.id.localeCompare(b.id));

/** Besvarar ett helt kapiteltest. `wrong` = antal frågor som medvetet besvaras fel. */
export async function takeQuiz(page: Page, chapter: Chapter, wrong = 0) {
  await page.getByTestId("start-quiz").click();
  for (let i = 0; i < 5; i++) {
    const pos = await page.getByTestId("quiz-position").textContent();
    const n = Number(/Fråga (\d+)/.exec(pos ?? "")?.[1]);
    expect(n).toBe(i + 1);
    // Hitta frågan utifrån rubriken i fieldset-legend
    const legend = await page.locator("#test fieldset legend").first().textContent();
    const q = chapter.quiz.find((x) => x.prompt === legend)!;
    const wantWrong = i < wrong;
    const opt = q.options.find((o) => Boolean(o.correct) !== wantWrong)!;
    await page.locator("#test").getByRole("radio", { name: opt.text, exact: true }).check();
    await page.getByTestId("answer").click();
    await page.locator("#test").getByRole("status").filter({ hasText: opt.correct ? "Rätt!" : "Inte rätt" }).waitFor();
    await page.getByTestId("next-question").click();
  }
}
