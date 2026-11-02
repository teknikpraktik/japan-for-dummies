"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import QRCode from "qrcode";
import { authClient } from "@/lib/auth-client";
import { useAccount } from "./AccountProvider";

/** Registrering av TOTP för lärare. Administratörsåtkomst ges först efter att en kod har verifierats (kontrolleras på servern). */
export function TwoFactorSetup() {
  const { status, user, refresh } = useAccount();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"start" | "scan" | "done">("start");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "loading") return <p aria-busy="true">Hämtar…</p>;
  if (!user || user.role !== "teacher")
    return (
      <div className="card prose-col space-y-3">
        <p>Tvåfaktor registreras av lärare efter inloggning.</p>
        <Link className="btn btn-primary" href="/logga-in/">Logga in</Link>
      </div>
    );
  if (user.twoFactorEnabled && step !== "done")
    return (
      <div className="card prose-col space-y-3" data-testid="already-enabled">
        <p>Tvåfaktor är redan aktiv för ditt konto.</p>
        <Link className="btn btn-primary" href="/lararen/">Till läraröversikten</Link>
      </div>
    );

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const r = await authClient.twoFactor.enable({ password, method: "totp" });
    setBusy(false);
    if (r.error || !r.data || r.data.method !== "totp") return setErr("Det gick inte att starta registreringen. Kontrollera lösenordet.");
    const uri = r.data.totpURI;
    setSecret(new URL(uri).searchParams.get("secret") ?? "");
    setCodes(r.data.backupCodes);
    // QR-koden skapas lokalt i webbläsaren. Hemligheten skickas aldrig till en tredjepartstjänst.
    setQr(await QRCode.toDataURL(uri, { margin: 1, width: 240 }));
    setPassword("");
    setStep("scan");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const r = await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, "") });
    setBusy(false);
    if (r.error) return setErr("Koden stämde inte eller har gått ut. Försök med en ny kod från appen.");
    await refresh();
    setStep("done");
  }

  if (step === "done")
    return (
      <div className="card prose-col space-y-3" role="status" data-testid="enrolled">
        <p className="feedback feedback-ok">Tvåfaktor är registrerad och verifierad. Du har nu administratörsåtkomst.</p>
        <button className="btn btn-primary" onClick={() => router.push("/lararen/")}>Till läraröversikten</button>
      </div>
    );

  return (
    <div className="space-y-6 prose-col">
      {step === "start" && (
        <form onSubmit={start} className="card space-y-3">
          <p>Du behöver en autentiseringsapp (till exempel en TOTP-app i telefonen). Bekräfta först med ditt lösenord.</p>
          <label htmlFor="pw" className="block font-semibold">Ditt lösenord</label>
          <input id="pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border-2 border-line bg-white p-3" data-testid="tf-password" />
          {err && <p role="alert" className="feedback feedback-wrong">{err}</p>}
          <button className="btn btn-primary" disabled={busy} data-testid="tf-start">Starta registrering</button>
        </form>
      )}
      {step === "scan" && (
        <>
          <section className="card space-y-3" aria-labelledby="s1">
            <h2 id="s1" className="!text-xl">1. Lägg till i din app</h2>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR-kod för att lägga till kontot i autentiseringsappen" width={240} height={240} className="rounded-lg border border-line" />
            )}
            <p className="text-sm">Kan du inte skanna? Skriv in hemligheten för hand: <code className="break-all font-mono" data-testid="tf-secret">{secret}</code></p>
          </section>
          <section className="card space-y-3" aria-labelledby="s2">
            <h2 id="s2" className="!text-xl">2. Spara återställningskoderna</h2>
            <p className="callout callout-check">Dessa koder låter dig logga in om du tappar bort din app. Varje kod fungerar en gång. De visas bara nu, så spara dem på ett säkert ställe.</p>
            <ul className="grid grid-cols-2 gap-1 font-mono" data-testid="tf-codes">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 h-5 w-5" checked={saved} onChange={(e) => setSaved(e.target.checked)} data-testid="tf-saved" />
              <span>Jag har sparat återställningskoderna.</span>
            </label>
          </section>
          <form onSubmit={verify} className="card space-y-3" aria-labelledby="s3">
            <h2 id="s3" className="!text-xl">3. Verifiera</h2>
            <label htmlFor="code" className="block font-semibold">Sexsiffrig kod från appen</label>
            <input id="code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} className="w-full rounded-lg border-2 border-line bg-white p-3 font-mono" data-testid="tf-code" />
            {err && <p role="alert" className="feedback feedback-wrong">{err}</p>}
            <button className="btn btn-primary" disabled={busy || !saved} data-testid="tf-verify">Verifiera och slutför</button>
          </form>
        </>
      )}
    </div>
  );
}
