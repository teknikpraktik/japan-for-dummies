import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Quiz } from "@/components/Quiz";
import { OrderingExercise } from "@/components/exercises/OrderingExercise";
import { ChoiceExercise } from "@/components/exercises/ChoiceExercise";
import { progressStore } from "@/lib/store";
import type { QuizQuestion } from "@/lib/schema";

const mk = (id: string): QuizQuestion => ({
  id,
  prompt: `Fråga ${id}`,
  options: [
    { id: "a", text: `${id}-fel`, correct: false, feedback: `Förklaring fel ${id}` },
    { id: "b", text: `${id}-rätt`, correct: true, feedback: `Förklaring rätt ${id}` },
    { id: "c", text: `${id}-fel2`, correct: false, feedback: `Förklaring fel2 ${id}` },
  ],
});
const questions = ["q1", "q2", "q3", "q4", "q5"].map(mk);

beforeEach(() => progressStore.__reset());
afterEach(() => progressStore.__reset());

/** Besvarar nästa synliga fråga genom att välja alternativ med given suffix-text. */
async function answer(user: ReturnType<typeof userEvent.setup>, which: "rätt" | "fel") {
  const pos = screen.getByTestId("quiz-position").textContent;
  void pos;
  const radios = screen.getAllByRole("radio");
  const target = radios.find((r) => (r.closest("label")?.textContent ?? "").includes(which === "rätt" ? "-rätt" : "-fel"))!;
  await user.click(target);
  await user.click(screen.getByTestId("answer"));
}

describe("kapiteltest", () => {
  it("fyra rätt av fem ger Klar, med återkoppling till både rätt och fel svar", async () => {
    const user = userEvent.setup();
    render(<Quiz chapterId="t01-k01" contentVersion={1} questions={questions} />);
    await user.click(await screen.findByTestId("start-quiz"));

    for (let i = 0; i < 5; i++) {
      await answer(user, i === 2 ? "fel" : "rätt");
      const fb = screen.getByRole("status");
      if (i === 2) {
        expect(fb).toHaveTextContent("Inte rätt");
        expect(fb).toHaveTextContent("Förklaring fel");
        expect(fb).toHaveTextContent("Rätt svar:");
        expect(fb).toHaveTextContent("Förklaring rätt");
      } else {
        expect(fb).toHaveTextContent("Rätt!");
      }
      await user.click(screen.getByTestId("next-question"));
    }
    const result = screen.getByTestId("quiz-result");
    expect(within(result).getByText(/Du fick 4 av 5 rätt/)).toBeInTheDocument();
    expect(within(result).getAllByText(/Klar/).length).toBeGreaterThan(0);
    const snap = progressStore.getSnapshot().state;
    expect(snap.chapters["t01-k01"].best?.score).toBe(4);
    expect(snap.chapters["t01-k01"].completedAt).toBeTruthy();
  });

  it("tre rätt ger inte Klar, och omförsök är obegränsade och bevarar bästa resultat", async () => {
    const user = userEvent.setup();
    render(<Quiz chapterId="t01-k01" contentVersion={1} questions={questions} />);
    await user.click(await screen.findByTestId("start-quiz"));
    for (let i = 0; i < 5; i++) {
      await answer(user, i < 3 ? "rätt" : "fel");
      await user.click(screen.getByTestId("next-question"));
    }
    expect(screen.getByText(/Du fick 3 av 5 rätt/)).toBeInTheDocument();
    expect(progressStore.getSnapshot().state.chapters["t01-k01"].completedAt).toBeUndefined();

    // omförsök 1: alla rätt
    await user.click(screen.getByTestId("retry"));
    for (let i = 0; i < 5; i++) {
      await answer(user, "rätt");
      await user.click(screen.getByTestId("next-question"));
    }
    expect(screen.getByText(/Du fick 5 av 5 rätt/)).toBeInTheDocument();

    // omförsök 2: alla fel, bästa kvarstår
    await user.click(screen.getByTestId("retry"));
    for (let i = 0; i < 5; i++) {
      await answer(user, "fel");
      await user.click(screen.getByTestId("next-question"));
    }
    const ch = progressStore.getSnapshot().state.chapters["t01-k01"];
    expect(ch.best?.score).toBe(5);
    expect(ch.last?.score).toBe(0);
    expect(ch.completedAt).toBeTruthy();
  });

  it("svar går inte förlorade om sidan laddas om mitt i testet", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Quiz chapterId="t01-k01" contentVersion={1} questions={questions} />);
    await user.click(await screen.findByTestId("start-quiz"));
    await answer(user, "rätt");
    await user.click(screen.getByTestId("next-question"));
    await answer(user, "rätt");
    unmount();

    progressStore.__reset(); // ny sidladdning: läser från localStorage
    render(<Quiz chapterId="t01-k01" contentVersion={1} questions={questions} />);
    expect(await screen.findByTestId("quiz-position")).toHaveTextContent("Fråga 3 av 5");
  });

  it("resultatet visas igen efter omladdning när testet är färdigt", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Quiz chapterId="t01-k01" contentVersion={1} questions={questions} />);
    await user.click(await screen.findByTestId("start-quiz"));
    for (let i = 0; i < 5; i++) {
      await answer(user, "rätt");
      await user.click(screen.getByTestId("next-question"));
    }
    unmount();
    progressStore.__reset();
    render(<Quiz chapterId="t01-k01" contentVersion={1} questions={questions} />);
    expect(await screen.findByTestId("quiz-result")).toHaveTextContent("5 av 5");
  });

  it("kan besvaras med enbart tangentbord", async () => {
    const user = userEvent.setup();
    render(<Quiz chapterId="t01-k01" contentVersion={1} questions={questions} />);
    await user.click(await screen.findByTestId("start-quiz"));
    await user.tab(); // första radioknappen
    expect(screen.getAllByRole("radio")[0]).toHaveFocus();
    await user.keyboard("[ArrowDown]"); // välj nästa alternativ
    await user.keyboard("[Tab]");
    expect(screen.getByTestId("answer")).toHaveFocus();
    await user.keyboard("[Enter]");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

describe("övningar", () => {
  it("ordningsövning: knappar flyttar steg och kontroll ger återkoppling", async () => {
    const user = userEvent.setup();
    render(
      <OrderingExercise
        exercise={{
          type: "ordering",
          id: "ord",
          title: "t",
          prompt: "Ordna",
          items: [
            { id: "a", text: "Steg A" },
            { id: "b", text: "Steg B" },
            { id: "c", text: "Steg C" },
          ],
          explanation: "A före B före C.",
        }}
      />,
    );
    const items = () => screen.getAllByRole("listitem").map((li) => li.textContent ?? "");
    // Flytta tills rätt ordning nås med hjälp av knapparna.
    for (let guard = 0; guard < 10; guard++) {
      const order: string[] = items().map((t) => (t.includes("Steg A") ? "A" : t.includes("Steg B") ? "B" : "C"));
      const want: string[] = ["A", "B", "C"];
      const wrong = order.findIndex((v, i) => v !== want[i]);
      if (wrong === -1) break;
      await user.click(screen.getByRole("button", { name: `Flytta upp: Steg ${want[wrong]}` }));
    }
    await user.click(screen.getByRole("button", { name: /Kontrollera/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Rätt ordning");
  });

  it("scenario: förklarar varje val och tillåter nytt försök", async () => {
    const user = userEvent.setup();
    render(
      <ChoiceExercise
        exercise={{
          type: "scenario",
          id: "s",
          title: "t",
          situation: "Du är på stationen.",
          question: "Vad gör du?",
          options: [
            { id: "a", text: "Alternativ A", correct: true, feedback: "A är bra" },
            { id: "b", text: "Alternativ B", correct: false, feedback: "B är mindre bra" },
          ],
        }}
      />,
    );
    await user.click(screen.getByLabelText("Alternativ B"));
    await user.click(screen.getByRole("button", { name: "Välj handling" }));
    expect(screen.getByRole("status")).toHaveTextContent("B är mindre bra");
    expect(screen.getByText(/Bästa alternativet: Alternativ A/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Försök igen" }));
    await user.click(screen.getByLabelText("Alternativ A"));
    await user.click(screen.getByRole("button", { name: "Välj handling" }));
    expect(screen.getByRole("status")).toHaveTextContent("A är bra");
  });
});
