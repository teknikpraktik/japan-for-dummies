import type { QuizQuestion } from "./schema";

export const QUIZ_LENGTH = 5;
/** Antal rätta svar som krävs för markeringen ”Klar”. */
export const PASS_MARK = 4;

export function isPassed(score: number): boolean {
  return score >= PASS_MARK;
}

/** Räknar rätta svar. answers: frågeID → valt alternativ-ID. Obesvarade/okända räknas som fel. */
export function scoreQuiz(questions: QuizQuestion[], answers: Record<string, string>): number {
  let score = 0;
  for (const q of questions) {
    const chosen = answers[q.id];
    if (chosen && q.options.some((o) => o.id === chosen && o.correct)) score++;
  }
  return score;
}

export function isFullyAnswered(questions: QuizQuestion[], answers: Record<string, string>): boolean {
  return questions.every((q) => q.options.some((o) => o.id === answers[q.id]));
}

/** Signatur för ett test: ändras om frågorna byts ut. Används för att avgöra om ett pågående utkast fortfarande gäller. */
export function quizSignature(questions: QuizQuestion[]): string {
  return questions.map((q) => q.id + ":" + q.options.map((o) => o.id).join("")).join("|");
}
