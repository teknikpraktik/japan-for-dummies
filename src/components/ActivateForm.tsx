"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export function ActivateForm() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [info, setInfo] = useState<{ valid: boolean; displayName?: string; loginName?: string } | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/aktivera/${token}/`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo({ valid: false }));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw !== pw2) return setMsg("Lösenorden är inte lika.");
    if (pw.length < 12) return setMsg("Lösenordet ska vara minst 12 tecken.");
    const r = await fetch(`/api/aktivera/${token}/`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }), credentials: "same-origin" });
    const d = (await r.json()) as { ok?: boolean; loginName?: string; message?: string };
    if (r.ok && d.ok) setDone(d.loginName ?? "");
    else setMsg(d.message ?? "Länken är ogiltig eller har gått ut.");
  }

  if (!info) return <p aria-busy="true">Kontrollerar länken…</p>;
  if (done !== null)
    return (
      <div className="card prose-col space-y-3" data-testid="activated">
        <p>Lösenordet är sparat. Logga in med <strong>{done}</strong> och ditt nya lösenord.</p>
        <Link className="btn btn-primary" href="/logga-in/">Till inloggningen</Link>
      </div>
    );
  if (!info.valid) return <p className="feedback feedback-wrong prose-col" role="alert">Länken är ogiltig eller har gått ut. Be en lärare i gruppen om en ny.</p>;
  return (
    <form onSubmit={submit} className="card prose-col space-y-4">
      <p>
        Hej {info.displayName}! Ditt inloggningsnamn är <strong>{info.loginName}</strong>.
      </p>
      <div>
        <label htmlFor="pw" className="block font-semibold">Nytt lösenord (minst 12 tecken)</label>
        <input id="pw" type="password" autoComplete="new-password" required minLength={12} value={pw} onChange={(e) => setPw(e.target.value)} className="mt-1 w-full rounded-lg border-2 border-line bg-white p-3" data-testid="pw" />
      </div>
      <div>
        <label htmlFor="pw2" className="block font-semibold">Upprepa lösenordet</label>
        <input id="pw2" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} className="mt-1 w-full rounded-lg border-2 border-line bg-white p-3" data-testid="pw2" />
      </div>
      {msg && <p role="alert" className="feedback feedback-wrong">{msg}</p>}
      <button className="btn btn-primary" type="submit" data-testid="activate-submit">Spara lösenord</button>
    </form>
  );
}
