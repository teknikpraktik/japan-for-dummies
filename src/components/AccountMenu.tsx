"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount } from "./AccountProvider";
import { useSyncStatus } from "@/lib/sync";

/** Kontoruta i sidhuvudet: Logga in, eller namn + länkar + Logga ut (med varning om osynkade framsteg). */
export function AccountMenu() {
  const { status, user, unverified, logout } = useAccount();
  const sync = useSyncStatus();
  const router = useRouter();
  const [confirm, setConfirm] = useState<null | "pending" | "offline">(null);
  const [busy, setBusy] = useState(false);

  if (status === "loading") return <span className="text-sm text-ink-soft" aria-hidden="true">&nbsp;</span>;
  if (!user) {
    return (
      <Link href="/logga-in/" className="btn btn-small" data-testid="login-link">
        Logga in
      </Link>
    );
  }
  const home = user.role === "teacher" ? "/lararen/" : "/min-utbildning/";

  async function doLogout(force = false) {
    setBusy(true);
    const r = await logout({ force });
    setBusy(false);
    if (r.ok) {
      setConfirm(null);
      router.push("/");
      return;
    }
    setConfirm(r.reason ?? null);
  }

  return (
    <div className="relative flex flex-wrap items-center gap-2" data-testid="account-menu">
      <Link href={home} className="font-semibold" data-testid="account-name">
        {user.displayName}
        {unverified && <span className="sr-only"> (inloggningen är inte bekräftad, du är offline)</span>}
      </Link>
      <Link href="/konto/" className="text-sm">
        Konto
      </Link>
      <button className="btn btn-small" onClick={() => void doLogout(false)} disabled={busy || unverified} data-testid="logout">
        Logga ut
      </button>
      {confirm && (
        <div role="alertdialog" aria-labelledby="logout-title" className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,90vw)] rounded-xl border-2 border-red bg-card p-4 shadow-lg" data-testid="logout-confirm">
          <p id="logout-title" className="font-bold">
            {confirm === "offline" ? "Utloggning kräver internet" : "Osynkade framsteg"}
          </p>
          <p className="mt-1 text-sm">
            {confirm === "offline"
              ? "Du är offline, och sessionen kan inte avslutas på servern just nu. Anslut till internet och försök igen."
              : `Du har ${sync.pending} framsteg som inte har synkats. Om du loggar ut nu försvinner de från den här enheten och räknas inte i din status.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-small" onClick={() => setConfirm(null)} data-testid="logout-cancel">
              Avbryt
            </button>
            {confirm === "pending" && (
              <button className="btn btn-danger btn-small" onClick={() => void doLogout(true)} data-testid="logout-anyway">
                Logga ut ändå
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
