"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { QuizQuestion } from "@/lib/schema";
import { isFullyAnswered, isPassed, PASS_MARK, quizSignature, scoreQuiz } from "@/lib/scoring";
import { hashString, seededShuffle } from "@/lib/shuffle";
import { progressStore, useProgress } from "@/lib/store";
import { completedSinceExport, type QuizDraft } from "@/lib/progress";
import { OptionList } from "./exercises/OptionList";

interface Props {
  chapterId: string;
  contentVersion: number;
  questions: QuizQuestion[];
  nextHref?: { href: string; label: string };
  overviewHref?: string;
}

/** Ordning: seed 0 = författarens ordning, annars blandad (omförsök). */
function arrange(questions: QuizQuestion[], seed: number): QuizQuestion[] {
  if (seed === 0) return questions;
  return seededShuffle(questions, seed).map((q) => ({ ...q, options: seededShuffle(q.options, seed + hashString(q.id)) }));
}

export function Quiz({ chapterId, contentVersion, questions, nextHref, overviewHref }: Props) {
  const { hydrated, state } = useProgress();
  const signature = useMemo(() => quizSignature(questions), [questions]);
  const stored = state.drafts[chapterId];
  const draft = stored && stored.signature === signature ? stored : undefined;
  const progress = state.chapters[chapterId];

  function start() {
    const seed = progress?.last ? 1 + Math.floor(Math.random() * 2_000_000_000) : 0;
    progressStore.markStarted(chapterId, contentVersion);
    progressStore.setDraft(chapterId, { seed, signature, answers: {}, finished: false });
  }

  return (
    <section aria-labelledby="kapiteltest" className="space-y-4" id="test">
      <h2 id="kapiteltest">Kapiteltest</h2>
      {!hydrated ? (
        <p aria-busy="true">Laddar test…</p>
      ) : !draft ? (
        <div className="card space-y-3">
          <p>Fem frågor. Fyra rätt ger markeringen <strong>Klar</strong>. Du får förklaring till alla svar, ingen tidspress, och du kan försöka igen så många gånger du vill. Dina svar sparas om sidan laddas om.</p>
          {progress?.best && <ResultSummary best={progress.best.score} last={progress.last?.score} />}
          <button className="btn btn-primary" onClick={start} data-testid="start-quiz">
            {progress?.last ? "Gör testet igen" : "Starta testet"}
          </button>
        </div>
      ) : (
        <ActiveQuiz chapterId={chapterId} contentVersion={contentVersion} questions={questions} draft={draft} nextHref={nextHref} overviewHref={overviewHref} onRestart={start} />
      )}
    </section>
  );
}

function ResultSummary({ best, last }: { best: number; last?: number }) {
  return (
    <p>
      Bästa resultat: <strong>{best} av 5</strong>
      {last !== undefined && <> · Senaste försök: <strong>{last} av 5</strong></>}
      {isPassed(best) && <span className="badge badge-ok ml-2">✓ Klar</span>}
    </p>
  );
}

function ActiveQuiz({ chapterId, contentVersion, questions, draft, nextHref, overviewHref, onRestart }: Props & { draft: QuizDraft; onRestart: () => void }) {
  const ordered = useMemo(() => arrange(questions, draft.seed), [questions, draft.seed]);
  const [selected, setSelected] = useState<string | null>(null);
  /** Frågan vars återkoppling just visas (så att man hinner läsa innan nästa). */
  const [justAnswered, setJustAnswered] = useState<string | null>(null);
  const { state } = useProgress();

  const answers = draft.answers;
  const answeredCount = ordered.filter((q) => answers[q.id]).length;
  const done = isFullyAnswered(questions, answers) && !justAnswered;

  if (done) {
    const score = scoreQuiz(questions, answers);
    const prog = state.chapters[chapterId];
    return (
      <Results
        ordered={ordered}
        answers={answers}
        score={score}
        best={prog?.best?.score ?? score}
        nextHref={nextHref}
        overviewHref={overviewHref}
        onRestart={onRestart}
        showExportNudge={isPassed(score) && completedSinceExport(state) > 0}
      />
    );
  }

  const q = justAnswered ? ordered.find((x) => x.id === justAnswered)! : ordered.find((x) => !answers[x.id])!;
  const index = ordered.indexOf(q);
  const chosenId = answers[q.id];
  const chosen = q.options.find((o) => o.id === chosenId);
  const correct = q.options.find((o) => o.correct)!;

  function submit() {
    if (!selected) return;
    const nextAnswers = { ...answers, [q.id]: selected };
    const nextDraft: QuizDraft = { ...draft, answers: nextAnswers };
    if (isFullyAnswered(questions, nextAnswers)) {
      // Spara resultat och utkast i ett steg så att inget kan hamna i halvfärdigt läge.
      progressStore.finishQuiz(chapterId, contentVersion, scoreQuiz(questions, nextAnswers), { ...nextDraft, finished: true });
    } else {
      progressStore.setDraft(chapterId, nextDraft);
    }
    setJustAnswered(q.id);
    setSelected(null);
  }

  return (
    <div className="card space-y-4">
      <div>
        <p className="text-sm font-semibold text-ink-soft" data-testid="quiz-position">
          Fråga {index + 1} av {ordered.length}
        </p>
        <div className="progress-track mt-1" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${((justAnswered ? answeredCount : answeredCount) / ordered.length) * 100}%` }} />
        </div>
      </div>
      <OptionList
        legend={q.prompt}
        options={q.options.map((o) => ({ id: o.id, text: o.text }))}
        value={justAnswered ? chosenId : selected}
        onChange={(id) => (justAnswered ? undefined : setSelected(id))}
        reveal={justAnswered ? { chosen: chosenId, correct: correct.id } : undefined}
      />
      {!justAnswered ? (
        <button className="btn btn-primary" disabled={!selected} onClick={submit} data-testid="answer">
          Svara
        </button>
      ) : (
        <div className="space-y-3">
          <div role="status" className={`feedback ${chosen?.correct ? "feedback-ok" : "feedback-wrong"}`}>
            <p className="font-bold">{chosen?.correct ? "Rätt!" : "Inte rätt."}</p>
            <p>{chosen?.feedback}</p>
            {!chosen?.correct && (
              <p className="mt-2">
                <strong>Rätt svar:</strong> {correct.text}. {correct.feedback}
              </p>
            )}
          </div>
          <button className="btn btn-primary" onClick={() => setJustAnswered(null)} data-testid="next-question">
            {isFullyAnswered(questions, answers) ? "Se resultat" : "Nästa fråga"}
          </button>
        </div>
      )}
    </div>
  );
}

function Results({
  ordered,
  answers,
  score,
  best,
  nextHref,
  overviewHref,
  onRestart,
  showExportNudge,
}: {
  ordered: QuizQuestion[];
  answers: Record<string, string>;
  score: number;
  best: number;
  nextHref?: { href: string; label: string };
  overviewHref?: string;
  onRestart: () => void;
  showExportNudge: boolean;
}) {
  const passed = isPassed(score);
  return (
    <div className="space-y-4" data-testid="quiz-result">
      <div className={`feedback ${passed ? "feedback-ok" : ""}`} role="status">
        <p className="text-xl font-bold">
          Du fick {score} av {ordered.length} rätt. {passed && <span className="badge badge-ok ml-1">✓ Klar</span>}
        </p>
        <p>
          {passed
            ? "Bra jobbat! Kapitlet är markerat som klart."
            : `Fyra rätt krävs för markeringen Klar (du fick ${score}). Läs förklaringarna nedan och försök igen när du vill.`}
        </p>
        <p className="mt-1">Bästa resultat: {Math.max(best, score)} av 5.</p>
      </div>
      <ol className="space-y-3">
        {ordered.map((q, i) => {
          const chosen = q.options.find((o) => o.id === answers[q.id]);
          const correct = q.options.find((o) => o.correct)!;
          return (
            <li key={q.id} className="card !p-3">
              <p className="font-semibold">
                {i + 1}. {q.prompt}
              </p>
              <p className={chosen?.correct ? "text-ok" : "text-red"}>
                <strong>{chosen?.correct ? "✓ Rätt" : "✗ Fel"}:</strong> Ditt svar: {chosen?.text}
              </p>
              <p className="text-sm">{chosen?.feedback}</p>
              {!chosen?.correct && (
                <p className="mt-1 text-sm">
                  <strong>Rätt svar:</strong> {correct.text}. {correct.feedback}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {showExportNudge && (
        <p className="callout callout-check">
          Du har framsteg som inte är exporterade. <Link href="/resepass/#export">Exportera dem under Resepass</Link> så att de inte försvinner om webbdata rensas.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={onRestart} data-testid="retry">
          Försök igen
        </button>
        <Link className="btn" href={overviewHref ?? "/utbildning/"}>
          Till översikten
        </Link>
        {nextHref && (
          <Link className="btn" href={nextHref.href}>
            {nextHref.label}
          </Link>
        )}
      </div>
      <p className="text-sm text-ink-soft">Omförsök kan visa frågorna och svarsalternativen i annan ordning. Gränsen för Klar är {PASS_MARK} av 5.</p>
    </div>
  );
}
