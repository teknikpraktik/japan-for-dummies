"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Env = "ios" | "android-chrome" | "android-firefox" | "desktop-safari" | "desktop-chromium" | "desktop-firefox" | "other";

function detect(): Env {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (iOS) return "ios";
  if (/Android/.test(ua)) return /Firefox/.test(ua) ? "android-firefox" : "android-chrome";
  if (/Firefox/.test(ua)) return "desktop-firefox";
  if (/Edg\/|Chrome\//.test(ua)) return "desktop-chromium";
  if (/Safari\//.test(ua)) return "desktop-safari";
  return "other";
}

const steps: Record<Env, { title: string; text: string }> = {
  ios: { title: "iPhone och iPad (Safari)", text: "Tryck på Dela-knappen (fyrkant med pil upp) och välj ”Lägg till på hemskärmen”. Funktionen finns i Safari; i andra webbläsare på iOS varierar den." },
  "android-chrome": { title: "Android (Chrome, Edge m.fl.)", text: "Öppna webbläsarens meny (⋮) och välj ”Installera app” eller ”Lägg till på startskärmen”. Ibland visas en ruta av sig själv, men räkna inte med det." },
  "android-firefox": { title: "Android (Firefox)", text: "Öppna menyn och välj ”Installera” eller ”Lägg till på startskärmen”, om alternativet visas." },
  "desktop-safari": { title: "Mac (Safari 17 eller senare)", text: "Välj Arkiv → ”Lägg till i Dock”. I äldre versioner av Safari finns inte installation, men sidan fungerar som vanligt i webbläsaren." },
  "desktop-chromium": { title: "Dator (Chrome eller Edge)", text: "Leta efter installationsikonen i adressfältet, eller välj menyn → ”Installera Japan for Dummies” (Chrome: ”Cast, spara och dela” → ”Installera sida som app”)." },
  "desktop-firefox": { title: "Dator (Firefox)", text: "Firefox på dator kan inte installera webbappar. Du kan fortfarande använda sidan i webbläsaren, och göra den tillgänglig offline nedan." },
  other: { title: "Din webbläsare", text: "Leta efter ”Installera” eller ”Lägg till på startskärmen/hemskärmen” i webbläsarens meny. Alla webbläsare erbjuder det inte." },
};

const noopSubscribe = () => () => {};

export function InstallHelp() {
  const env = useSyncExternalStore(noopSubscribe, detect, () => null);
  const standalone = useSyncExternalStore(noopSubscribe, () => window.matchMedia("(display-mode: standalone)").matches, () => false);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  // Redan installerad (kan avgöras säkert via display-mode): ingen installationsåtgärd behövs.
  if (standalone) return null;

  return (
    <details className="tool" id="installera">
      <summary>Installera som app</summary>
      <div className="space-y-3 pt-2 text-sm">
        <p>Du kan lägga utbildningen på hemskärmen eller i dockan så att den öppnas som en app. Det är valfritt.</p>
        {prompt && (
          <button
            className="btn btn-primary btn-small"
            onClick={async () => {
              await prompt.prompt();
              await prompt.userChoice;
              setPrompt(null);
            }}
          >
            Installera appen
          </button>
        )}
        {env && (
          <div>
            <p className="font-semibold">{steps[env].title}</p>
            <p>{steps[env].text}</p>
          </div>
        )}
        <details>
          <summary className="cursor-pointer font-semibold">Instruktioner för andra webbläsare</summary>
          <ul className="mt-2 space-y-2">
            {(Object.keys(steps) as Env[])
              .filter((k) => k !== env && k !== "other")
              .map((k) => (
                <li key={k}>
                  <strong>{steps[k].title}:</strong> {steps[k].text}
                </li>
              ))}
          </ul>
        </details>
      </div>
    </details>
  );
}
