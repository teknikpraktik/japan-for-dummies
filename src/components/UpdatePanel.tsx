"use client";

import { swUpdate, useSwUpdateAvailable } from "@/lib/sw-update-store";

/** Ny version av utbildningen: visas bara på Min utbildning, och genomförs bara på användarens initiativ. */
export function UpdatePanel() {
  const available = useSwUpdateAvailable();
  if (!available) return null;
  return (
    <section aria-labelledby="ny-version" className="card space-y-2 !border-indigo" data-testid="update-available" role="status">
      <h2 id="ny-version" className="!text-xl">Det finns en ny version av utbildningen</h2>
      <p className="text-sm">Dina framsteg och pågående test sparas. Uppdatera när det passar, till exempel efter ett pågående test. Sidan laddas om.</p>
      <button className="btn btn-primary btn-small" onClick={() => swUpdate.apply()} data-testid="update-now">
        Uppdatera nu
      </button>
    </section>
  );
}
