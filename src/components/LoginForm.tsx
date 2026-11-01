"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useAccount } from "./AccountProvider";

type Who = "student" | "teacher";

/** Eleven skriver ofta koden med bindestreck, blanksteg eller små bokstäver; normalisera likadant som vid skapandet. */
const normalizeCode = (s: string) => s.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
const GENERIC = "Fel användarnamn eller kod. Kontrollera och försök igen.";

export function LoginForm() {
  const router = useRouter();
  const { refresh, user } = useAccount();
  const [who, setWho] = useState<Who>("student");
  const [identity, setIdentity] = useState("");
  const [secret, setSecret] = useState("");
  const [step, setStep] = useState<"credentials" | "totp" | "backup">("credentials");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function afterLogin() {
    await refresh();
    const res = await fetch("/api/me/", { credentials: "same-origin", cache: "no-store" });
    const me = (await res.json()) as { user: { role: "student" | "teacher"; enrollmentRequired: boolean } | null };
    if (!me.user) return setError(GENERIC);
    if (me.user.role === "teacher") router.push(me.user.enrollmentRequired ? "/konto/tvafaktor/" : "/lararen/");
    else router.push("/min-utbildning/");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (step === "credentials") {
        if (who === "student") {
          const r = await authClient.signIn.username({ username: identity.trim().toLowerCase(), password: normalizeCode(secret) });
          if (r.error) setError(r.error.status === 429 ? "För många försök. Vänta en stund och försök igen." : GENERIC);
          else await afterLogin();
        } else {
          const r = await authClient.signIn.email({ email: identity.trim().toLowerCase(), password: secret });
          if (r.error) setError(r.error.status === 429 ? "För många försök. Vänta en stund och försök igen." : GENERIC);
          else if (r.data && "twoFactorRedirect" in r.data && r.data.twoFactorRedirect) setStep("totp");
          else await afterLogin();
        }
      } else if (step === "totp") {
        const r = await authClient.twoFactor.verifyTotp({ code: otp.replace(/\s/g, "") });
        if (r.error) setError("Koden stämde inte eller har gått ut. Försök igen.");
        else await afterLogin();
      } else {
        const r = await authClient.twoFactor.verifyBackupCode({ code: otp.trim() });
        if (r.error) setError("Återställningskoden stämde inte.");
        else await afterLogin();
      }
    } catch {
      setError("Det gick inte att nå servern. Inloggning kräver internet.");
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    return (
      <p className="card prose-col">
        Du är inloggad som <strong>{user.displayName}</strong>. <Link href={user.role === "teacher" ? "/lararen/" : "/min-utbildning/"}>Fortsätt</Link>.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="card prose-col space-y-4" aria-describedby={error ? "login-error" : undefined} data-testid="login-form">
      {step === "credentials" && (
        <>
          <fieldset className="space-y-2">
            <legend className="mb-1 font-semibold">Jag är</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["student", "teacher"] as const).map((w) => (
                <label key={w} className="option justify-center text-center font-semibold" data-state={who === w ? "selected" : undefined}>
                  <input type="radio" name="who" value={w} checked={who === w} onChange={() => { setWho(w); setIdentity(""); setSecret(""); setError(null); }} className="sr-only" />
                  {w === "student" ? "Elev" : "Lärare"}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="identity" className="block font-semibold">
              {who === "student" ? "Användarnamn" : "E-postadress (inloggningsnamn)"}
            </label>
            <input id="identity" name="identity" type={who === "student" ? "text" : "email"} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required value={identity} onChange={(e) => setIdentity(e.target.value)} className="mt-1 w-full rounded-lg border-2 border-line bg-white p-3" data-testid="identity" />
          </div>
          <div>
            <label htmlFor="secret" className="block font-semibold">
              {who === "student" ? "Inloggningskod" : "Lösenord"}
            </label>
            <input id="secret" name="secret" type="password" autoComplete="current-password" autoCapitalize="none" required value={secret} onChange={(e) => setSecret(e.target.value)} className="mt-1 w-full rounded-lg border-2 border-line bg-white p-3 font-mono" data-testid="secret" />
            {who === "student" && <p className="mt-1 text-sm text-ink-soft">Koden står på ditt inloggningskort. Du kan skriva den med eller utan bindestreck.</p>}
          </div>
        </>
      )}
      {step !== "credentials" && (
        <div>
          <label htmlFor="otp" className="block font-semibold">
            {step === "totp" ? "Sexsiffrig kod från din autentiseringsapp" : "Återställningskod"}
          </label>
          <input id="otp" name="otp" inputMode={step === "totp" ? "numeric" : "text"} autoComplete="one-time-code" required value={otp} onChange={(e) => setOtp(e.target.value)} className="mt-1 w-full rounded-lg border-2 border-line bg-white p-3 font-mono" data-testid="otp" />
          <p className="mt-2 text-sm">
            <button type="button" className="underline" onClick={() => { setStep(step === "totp" ? "backup" : "totp"); setOtp(""); setError(null); }}>
              {step === "totp" ? "Jag har tappat bort min app: använd en återställningskod" : "Använd koden från appen i stället"}
            </button>
          </p>
        </div>
      )}
      {error && (
        <p id="login-error" role="alert" className="feedback feedback-wrong" data-testid="login-error">
          {error}
        </p>
      )}
      <button className="btn btn-primary w-full" type="submit" disabled={busy} data-testid="login-submit">
        {busy ? "Loggar in…" : step === "credentials" ? "Logga in" : "Verifiera"}
      </button>
      <p className="text-sm text-ink-soft">Har du glömt din kod? Be din lärare om en ny. Ingen kan se din gamla kod.</p>
    </form>
  );
}
