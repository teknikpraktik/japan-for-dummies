"use client";

import type { Exercise } from "@/lib/schema";
import { ChoiceExercise } from "./ChoiceExercise";
import { OrderingExercise } from "./OrderingExercise";

const typeLabel = { "multiple-choice": "Flervalsfråga", ordering: "Ordna i rätt följd", scenario: "Vardagsscenario" } as const;

export function ExerciseRenderer({ exercise }: { exercise: Exercise }) {
  return (
    <section aria-labelledby={`ex-${exercise.id}`} className="card space-y-3">
      <header>
        <p className="text-sm font-bold uppercase tracking-wide text-ink-soft">{typeLabel[exercise.type]}</p>
        <h3 id={`ex-${exercise.id}`}>{exercise.title}</h3>
      </header>
      {exercise.type === "ordering" ? <OrderingExercise exercise={exercise} /> : <ChoiceExercise exercise={exercise} />}
    </section>
  );
}
