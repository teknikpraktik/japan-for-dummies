"use client";

import { useState } from "react";
import type { MultipleChoiceExercise, ScenarioExercise } from "@/lib/schema";
import { OptionList } from "./OptionList";

/** Används för både flervalsfråga och vardagsscenario. Eleven kan prova flera alternativ och får förklaring till varje. */
export function ChoiceExercise({ exercise }: { exercise: MultipleChoiceExercise | ScenarioExercise }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState<string | null>(null);
  const isScenario = exercise.type === "scenario";
  const chosen = exercise.options.find((o) => o.id === answered);
  const correct = exercise.options.find((o) => o.correct)!;

  return (
    <div className="space-y-3">
      {isScenario && (
        <p className="card !bg-paper-2">
          <span className="block text-sm font-bold uppercase tracking-wide text-ink-soft">Situation</span>
          {exercise.situation}
        </p>
      )}
      <OptionList
        legend={isScenario ? exercise.question : exercise.prompt}
        options={exercise.options.map((o) => ({ id: o.id, text: o.text }))}
        value={answered ? answered : selected}
        onChange={(id) => (answered ? undefined : setSelected(id))}
        disabled={false}
        reveal={answered ? { chosen: answered, correct: correct.id } : undefined}
      />
      {!answered ? (
        <button className="btn btn-primary" disabled={!selected} onClick={() => setAnswered(selected)}>
          {isScenario ? "Välj handling" : "Svara"}
        </button>
      ) : (
        <div className="space-y-3">
          <div role="status" className={`feedback ${chosen?.correct ? "feedback-ok" : "feedback-wrong"}`}>
            <p className="font-bold">{chosen?.correct ? "Rätt!" : "Inte riktigt."}</p>
            <p>{chosen?.feedback}</p>
          </div>
          {!chosen?.correct && (
            <div className="feedback feedback-ok">
              <p className="font-bold">Bästa alternativet: {correct.text}</p>
              <p>{correct.feedback}</p>
            </div>
          )}
          <details className="card !py-2">
            <summary className="cursor-pointer font-semibold">Läs om de andra alternativen</summary>
            <ul className="mt-2 space-y-2">
              {exercise.options
                .filter((o) => o.id !== answered && !o.correct)
                .map((o) => (
                  <li key={o.id}>
                    <strong>{o.text}</strong>
                    <br />
                    {o.feedback}
                  </li>
                ))}
            </ul>
          </details>
          <button
            className="btn btn-small"
            onClick={() => {
              setAnswered(null);
              setSelected(null);
            }}
          >
            Försök igen
          </button>
        </div>
      )}
    </div>
  );
}
