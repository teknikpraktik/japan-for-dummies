import { describe, expect, it } from "vitest";
import { isFullyAnswered, isPassed, PASS_MARK, quizSignature, scoreQuiz } from "@/lib/scoring";
import type { QuizQuestion } from "@/lib/schema";

const q = (id: string): QuizQuestion => ({
  id,
  prompt: id,
  options: [
    { id: "a", text: "A", correct: false, feedback: "f" },
    { id: "b", text: "B", correct: true, feedback: "f" },
  ],
});
const questions = ["q1", "q2", "q3", "q4", "q5"].map(q);

describe("scoreQuiz", () => {
  it("räknar rätta svar", () => {
    expect(scoreQuiz(questions, { q1: "b", q2: "b", q3: "a", q4: "b", q5: "b" })).toBe(4);
    expect(scoreQuiz(questions, { q1: "b", q2: "b", q3: "b", q4: "b", q5: "b" })).toBe(5);
    expect(scoreQuiz(questions, {})).toBe(0);
  });
  it("behandlar okända alternativ som fel", () => {
    expect(scoreQuiz(questions, { q1: "zzz", q2: "b" })).toBe(1);
  });
  it("gränsen är fyra av fem", () => {
    expect(PASS_MARK).toBe(4);
    expect(isPassed(3)).toBe(false);
    expect(isPassed(4)).toBe(true);
    expect(isPassed(5)).toBe(true);
  });
  it("känner av ofullständiga svar", () => {
    expect(isFullyAnswered(questions, { q1: "a" })).toBe(false);
    expect(isFullyAnswered(questions, { q1: "a", q2: "a", q3: "a", q4: "a", q5: "a" })).toBe(true);
  });
  it("signaturen ändras när frågorna ändras", () => {
    const changed = [...questions.slice(0, 4), q("q6")];
    expect(quizSignature(changed)).not.toBe(quizSignature(questions));
  });
});
