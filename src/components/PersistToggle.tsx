"use client";

import { useAccount } from "./AccountProvider";

/** Uttryckligt val: spara personliga framsteg på en egen enhet. Standard är att inget lämnas kvar efter utloggning. */
export function PersistToggle() {
  const { user, persist, setPersist } = useAccount();
  if (!user || user.role !== "student") return null;
  return (
    <section aria-labelledby="persist" className="card space-y-2" data-testid="persist-panel">
      <h2 id="persist" className="!text-xl">Spara på den här enheten</h2>
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 h-5 w-5" checked={persist} onChange={(e) => setPersist(e.target.checked)} data-testid="persist-toggle" />
        <span>
          Spara mina framsteg på den här enheten så att jag kan arbeta offline. <strong>Välj bara detta på din egen enhet.</strong>
        </span>
      </label>
      <p className="text-sm text-ink-soft">
        Standard (avstängt) är att inget personligt lämnas kvar i webbläsaren efter att du loggat ut eller stängt fliken. Av säkerhetsskäl kräver inloggning alltid internet.
      </p>
    </section>
  );
}
