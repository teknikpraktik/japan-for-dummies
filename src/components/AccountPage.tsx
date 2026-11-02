"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useAccount } from "./AccountProvider";
import { PersistToggle } from "./PersistToggle";

export function AccountPage() {
  const { status, user, unverified } = useAccount();
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [bcPw, setBcPw] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [other, setOther] = useState<string | null>(null);

  if (status === "loading") return <p aria-busy="true">Hämtar…</p>;
  if (!user)
    return (
      <div className="card prose-col space-y-3">
        <p>Du är inte inloggad.</p>
        <Link className="btn btn-primary" href="/logga-in/">Logga in</Link>
      </div>
    );

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw !== pw2) return setMsg({ ok: false, text: "De nya lösenorden är inte lika." });
    if (pw.length < 12) return setMsg({ ok: false, text: "Lösenordet ska vara minst 12 tecken." });
    const r = await authClient.changePassword({ currentPassword: cur, newPassword: pw, revokeOtherSessions: true });
    if (r.error) setMsg({ ok: false, text: "Det gick inte att byta lösenord. Kontrollera ditt nuvarande lösenord." });
    else {
      setMsg({ ok: true, text: "Lösenordet är bytt. Andra enheter har loggats ut." });
      setCur("");
      setPw("");
      setPw2("");
    }
  }
  async function newCodes(e: React.FormEvent) {
    e.preventDefault();
    const r = await authClient.twoFactor.generateBackupCodes({ password: bcPw });
    if (r.error || !r.data) setMsg({ ok: false, text: "Det gick inte att skapa nya återställningskoder. Kontrollera lösenordet." });
    else {
      setCodes(r.data.backupCodes);
      setBcPw("");
    }
  }

  const teacher = user.role === "teacher";
  return (
    <div className="space-y-6 prose-col">
      <section className="card space-y-1" aria-labelledby="om">
        <h2 id="om" className="!text-xl">Du är inloggad</h2>
        <p>
          <strong>{user.displayName}</strong> · {teacher ? "lärare" : "elev"}{user.groupName ? ` · grupp ${user.groupName}` : ""}
        </p>
        {unverified && <p className="callout callout-check">Du är offline och inloggningen kan inte bekräftas. Kontoinställningar kräver internet.</p>}
      </section>

      {teacher && !unverified && (
        <>
          <section className="card space-y-2" aria-labelledby="tf">
            <h2 id="tf" className="!text-xl">Tvåfaktorsinloggning</h2>
            <p>{user.twoFactorEnabled ? "Tvåfaktor är aktiv." : "Tvåfaktor är valfritt och inte aktiverat. Du kan lägga till det för extra skydd av kontot."}</p>
            {!user.twoFactorEnabled && <Link className="btn btn-primary" href="/konto/tvafaktor/">Aktivera tvåfaktor (valfritt)</Link>}
          </section>

          {user.twoFactorEnabled && (
            <form onSubmit={newCodes} className="card space-y-2" aria-labelledby="bc">
              <h2 id="bc" className="!text-xl">Nya återställningskoder</h2>
              <p className="text-sm">Om du skapar nya koder blir de gamla ogiltiga. Spara dem på ett säkert ställe.</p>
              <label htmlFor="bcpw" className="block font-semibold">Ditt lösenord</label>
              <input id="bcpw" type="password" autoComplete="current-password" required value={bcPw} onChange={(e) => setBcPw(e.target.value)} className="w-full rounded-lg border-2 border-line bg-white p-3" />
              <button className="btn">Skapa nya koder</button>
              {codes && (
                <div className="callout callout-check" role="status" data-testid="new-backup-codes">
                  <p className="font-bold">Spara dessa koder nu. De visas bara en gång.</p>
                  <ul className="mt-2 grid grid-cols-2 gap-1 font-mono">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
                </div>
              )}
            </form>
          )}

          <form onSubmit={changePassword} className="card space-y-2" aria-labelledby="cp">
            <h2 id="cp" className="!text-xl">Byt lösenord</h2>
            <label htmlFor="cur" className="block font-semibold">Nuvarande lösenord</label>
            <input id="cur" type="password" autoComplete="current-password" required value={cur} onChange={(e) => setCur(e.target.value)} className="w-full rounded-lg border-2 border-line bg-white p-3" />
            <label htmlFor="npw" className="block font-semibold">Nytt lösenord (minst 12 tecken)</label>
            <input id="npw" type="password" autoComplete="new-password" required minLength={12} value={pw} onChange={(e) => setPw(e.target.value)} className="w-full rounded-lg border-2 border-line bg-white p-3" />
            <label htmlFor="npw2" className="block font-semibold">Upprepa det nya lösenordet</label>
            <input id="npw2" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} className="w-full rounded-lg border-2 border-line bg-white p-3" />
            <button className="btn btn-primary">Byt lösenord</button>
          </form>
        </>
      )}

      {!teacher && (
        <section className="card space-y-1" aria-labelledby="kod">
          <h2 id="kod" className="!text-xl">Glömt eller tappat bort din kod?</h2>
          <p>Be din lärare om en ny kod. Din gamla kod blir då ogiltig direkt. Ingen kan se din gamla kod.</p>
        </section>
      )}

      {!unverified && (
        <section className="card space-y-2" aria-labelledby="sess">
          <h2 id="sess" className="!text-xl">Sessioner</h2>
          <button
            className="btn"
            onClick={async () => {
              const r = await authClient.revokeOtherSessions();
              setOther(r.error ? "Det gick inte att logga ut från andra enheter." : "Alla andra enheter är utloggade.");
            }}
          >
            Logga ut från alla andra enheter
          </button>
          {other && <p role="status">{other}</p>}
        </section>
      )}

      {msg && <p role={msg.ok ? "status" : "alert"} className={`feedback ${msg.ok ? "feedback-ok" : "feedback-wrong"}`}>{msg.text}</p>}
      <PersistToggle />
      <p className="text-sm">
        Använd knappen <strong>Logga ut</strong> i sidhuvudet för att logga ut. <Link href="/integritet/">Integritetsinformation</Link>.
      </p>
    </div>
  );
}
