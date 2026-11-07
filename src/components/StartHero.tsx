"use client";

import { useEffect, useLayoutEffect } from "react";
import { START_IMAGE_RUNTIME } from "@/lib/start-image";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Körs i webbläsaren vid mjuk navigering till startsidan, där de inbäddade skripten inte exekveras av webbläsaren.
 * Vid vanlig sidladdning har skriptet redan körts och figuren är märkt som klar, så ingenting görs (ingen omslumpning).
 */
export function StartHeroBoot() {
  useIsoLayoutEffect(() => {
    const fig = document.getElementById("start-hero");
    if (!fig || fig.hasAttribute("data-ready")) return;
    const s = document.createElement("script");
    s.textContent = START_IMAGE_RUNTIME;
    document.body.appendChild(s);
    s.remove();
  }, []);
  return null;
}
