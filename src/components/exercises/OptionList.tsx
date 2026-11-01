"use client";

import { useId } from "react";

export interface OptionView {
  id: string;
  text: string;
}

/**
 * Radiogrupp med stöd för tangentbord (pilar, mellanslag) och tydliga resultatmarkeringar.
 * `reveal` anger valt och rätt alternativ efter att ett svar lämnats.
 */
export function OptionList({
  legend,
  options,
  value,
  onChange,
  disabled,
  reveal,
}: {
  legend: React.ReactNode;
  options: OptionView[];
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
  reveal?: { chosen: string; correct: string };
}) {
  const name = useId();
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-2 font-semibold">{legend}</legend>
      {options.map((o) => {
        let state: string | undefined;
        let mark: string | null = null;
        if (reveal) {
          if (o.id === reveal.correct) {
            state = "correct";
            mark = "Rätt svar";
          } else if (o.id === reveal.chosen) {
            state = "wrong";
            mark = "Ditt svar (fel)";
          }
        } else if (value === o.id) state = "selected";
        return (
          <label key={o.id} className="option" data-state={state}>
            <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
            <span>
              {o.text}
              {mark && <span className="ml-2 text-sm font-bold">({mark})</span>}
              {reveal && o.id === reveal.chosen && o.id === reveal.correct && <span className="ml-2 text-sm font-bold">(Ditt svar)</span>}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
