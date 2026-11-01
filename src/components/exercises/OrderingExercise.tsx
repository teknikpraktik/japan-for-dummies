"use client";

import { useRef, useState } from "react";
import type { OrderingExercise as Ordering } from "@/lib/schema";
import { hashString, shuffleDifferent } from "@/lib/shuffle";

/** Ordna steg i rätt följd med upp/ned-knappar (fungerar med tangentbord och pekskärm; ingen dragning krävs). */
export function OrderingExercise({ exercise }: { exercise: Ordering }) {
  const [round, setRound] = useState(0);
  const [order, setOrder] = useState(() => shuffleDifferent(exercise.items, hashString(exercise.id)).map((i) => i.id));
  const [checked, setChecked] = useState(false);
  const [announce, setAnnounce] = useState("");
  const listRef = useRef<HTMLOListElement>(null);

  const byId = new Map(exercise.items.map((i) => [i.id, i]));
  const correctOrder = exercise.items.map((i) => i.id);
  const allRight = order.every((id, i) => id === correctOrder[i]);

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    setChecked(false);
    setAnnounce(`${byId.get(order[index])!.text} flyttad till plats ${target + 1} av ${order.length}.`);
    // Behåll fokus på samma knapp efter omrendering.
    requestAnimationFrame(() => {
      const btn = listRef.current?.querySelectorAll<HTMLButtonElement>(`li:nth-child(${target + 1}) button[data-dir="${dir}"]`)[0];
      (btn && !btn.disabled ? btn : listRef.current?.querySelector<HTMLButtonElement>(`li:nth-child(${target + 1}) button:not(:disabled)`))?.focus();
    });
  }

  return (
    <div className="space-y-3">
      <p className="font-semibold">{exercise.prompt}</p>
      <ol ref={listRef} className="space-y-2">
        {order.map((id, i) => {
          const item = byId.get(id)!;
          const right = checked ? id === correctOrder[i] : null;
          return (
            <li
              key={id}
              className="option !cursor-default items-center"
              data-state={right === null ? undefined : right ? "correct" : "wrong"}
            >
              <span aria-hidden="true" className="w-6 flex-none text-center font-bold">{i + 1}.</span>
              <span className="flex-1">
                {item.text}
                {item.note && <span lang="ja" className="ml-2 text-sm text-ink-soft">{item.note}</span>}
                {right !== null && <span className="ml-2 text-sm font-bold">{right ? "(rätt plats)" : "(fel plats)"}</span>}
              </span>
              <span className="flex flex-none gap-1">
                <button type="button" data-dir="-1" className="btn btn-small !min-w-11 !px-2" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Flytta upp: ${item.text}`}>
                  ↑
                </button>
                <button type="button" data-dir="1" className="btn btn-small !min-w-11 !px-2" disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label={`Flytta ner: ${item.text}`}>
                  ↓
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">{announce}</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={() => setChecked(true)}>
          Kontrollera ordningen
        </button>
        <button
          className="btn"
          onClick={() => {
            setRound((r) => r + 1);
            setOrder(shuffleDifferent(exercise.items, hashString(exercise.id) + round + 1).map((i) => i.id));
            setChecked(false);
            setAnnounce("Stegen är blandade på nytt.");
          }}
        >
          Blanda om
        </button>
      </div>
      {checked && (
        <div role="status" className={`feedback ${allRight ? "feedback-ok" : "feedback-wrong"}`}>
          <p className="font-bold">{allRight ? "Rätt ordning!" : "Inte riktigt rätt ännu. Justera och kontrollera igen."}</p>
          <p>{allRight ? exercise.explanation : `${order.filter((id, i) => id === correctOrder[i]).length} av ${order.length} ligger på rätt plats.`}</p>
          {!allRight && (
            <details className="mt-2">
              <summary className="cursor-pointer font-semibold">Visa rätt ordning och förklaring</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-6">
                {exercise.items.map((i) => (
                  <li key={i.id}>{i.text}</li>
                ))}
              </ol>
              <p className="mt-2">{exercise.explanation}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
