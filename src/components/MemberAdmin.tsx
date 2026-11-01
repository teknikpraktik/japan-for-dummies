"use client";

import { useCallback, useEffect, useState } from "react";
import { LoginCard } from "./LoginCard";
import { useAccount } from "./AccountProvider";

interface Member { userId: string; displayName: string; role: "student" | "teacher"; loginName: string | null; active: boolean; setupPending: boolean; createdAt: string }
interface Listing { group: string; selfId: string; members: Member[] }

type Pending =
  | { kind: "ny-kod" | "aktivera-igen" | "radera" | "avaktivera-lararen" | "aktiveringslank"; member: Member }
  | { kind: "roll-elev" | "roll-lararen"; member: Member }
  | { kind: "skapa-lararen" };

interface Issued { name: string; username: string; code: string; group: string }
interface IssuedLink { name: string; url: string; expires: string }

async function api(path: string, method: string, body?: unknown) {
  const r = await fetch(path, { method, credentials: "same-origin", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: r.ok, status: r.status, data };
}

const titles: Record<Pending["kind"], string> = {
  "ny-kod": "Ny inloggningskod",
  "aktivera-igen": "Aktivera igen",
  radera: "Radera konto",
  "avaktivera-lararen": "Avaktivera lärare",
  aktiveringslank: "Ny aktiveringslänk",
  "roll-elev": "Gör till elev",
  "roll-lararen": "Gör till lärare",
  "skapa-lararen": "Skapa lärare",
};

export function MemberAdmin({ mode }: { mode: "students" | "teachers" }) {
  const { user } = useAccount();
  const [list, setList] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [link, setLink] = useState<IssuedLink | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api("/api/lararen/medlemmar/", "GET");
      if (!r.ok) return setError(r.status === 401 ? "Du har blivit utloggad. Logga in igen." : "Kunde inte hämta listan.");
      setList(r.data as unknown as Listing);
      setError(null);
    } catch {
      setError("Det gick inte att nå servern. Administrationen kräver internet.");
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- datahämtning vid montering
    void load();
  }, [load]);

  async function createStudent(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const r = await api("/api/lararen/elever/", "POST", { displayName: newName });
    setBusy(false);
    if (!r.ok) return setNotice(String(r.data.message ?? "Kunde inte skapa eleven."));
    setIssued({ name: String(r.data.displayName), username: String(r.data.username), code: String(r.data.loginCode), group: String(r.data.group) });
    setNewName("");
    void load();
  }

  const members = (list?.members ?? []).filter((m) => m.role === (mode === "students" ? "student" : "teacher"));

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="feedback feedback-wrong prose-col">{error}</p>}
      {notice && <p role="alert" className="feedback feedback-wrong prose-col" data-testid="admin-notice">{notice}</p>}

      {issued && <LoginCard group={issued.group} name={issued.name} username={issued.username} code={issued.code} onClose={() => setIssued(null)} />}
      {link && (
        <section className="card space-y-2 border-2 border-red" data-testid="activation-link" aria-label="Aktiveringslänk">
          <p className="font-bold">Aktiveringslänk för {link.name}</p>
          <p className="callout callout-check" role="alert">Länken visas bara nu och gäller till {new Date(link.expires).toLocaleString("sv-SE")}. Ge den till läraren på ett säkert sätt (inte i en öppen kanal). Den kan bara användas en gång.</p>
          <input readOnly className="w-full rounded-lg border-2 border-line bg-white p-2 font-mono text-sm" value={link.url} onFocus={(e) => e.currentTarget.select()} data-testid="activation-url" aria-label="Aktiveringslänk" />
          <div className="flex gap-2">
            <button className="btn btn-small" onClick={() => void navigator.clipboard?.writeText(link.url)}>Kopiera länken</button>
            <button className="btn btn-small" onClick={() => setLink(null)}>Stäng</button>
          </div>
        </section>
      )}

      {mode === "students" && (
        <form onSubmit={createStudent} className="card prose-col space-y-3" aria-labelledby="skapa-elev">
          <h2 id="skapa-elev" className="!text-xl">Skapa elev</h2>
          <label htmlFor="elevnamn" className="block font-semibold">Förnamn eller alias</label>
          <input id="elevnamn" required maxLength={40} value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full rounded-lg border-2 border-line bg-white p-3" data-testid="student-name" autoComplete="off" />
          <p className="text-sm text-ink-soft">Skriv bara förnamn eller ett alias. Efternamn, personnummer, födelsedatum, telefon och e-post efterfrågas aldrig. Två elever får heta samma sak. Användarnamn och kod slumpas.</p>
          <button className="btn btn-primary" disabled={busy} data-testid="create-student">Skapa elev</button>
        </form>
      )}
      {mode === "teachers" && (
        <div>
          <button className="btn btn-primary" onClick={() => setPending({ kind: "skapa-lararen" })} data-testid="create-teacher">Skapa lärare</button>
        </div>
      )}

      <section aria-labelledby="lista" className="space-y-2">
        <h2 id="lista" className="!text-xl">{mode === "students" ? "Elever" : "Lärare"} ({members.length})</h2>
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.userId} className="card !p-3 space-y-2" data-testid={`member-${m.displayName}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">
                  {m.displayName} <span className="font-normal text-ink-soft">({m.loginName ?? "inget inloggningsnamn"})</span>
                  {m.userId === list?.selfId && <span className="badge badge-progress ml-2">Du</span>}
                </p>
                <p className="text-sm">
                  {!m.active ? <span className="badge badge-planned">Avaktiverad</span> : m.setupPending ? <span className="badge badge-progress">Väntar på aktivering/tvåfaktor</span> : <span className="badge badge-ok">Aktiv</span>}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {m.role === "student" ? (
                  <>
                    <button className="btn btn-small" onClick={() => setPending({ kind: m.active ? "ny-kod" : "aktivera-igen", member: m })} data-testid={`reset-${m.displayName}`}>{m.active ? "Ny kod" : "Aktivera med ny kod"}</button>
                    {m.active && <button className="btn btn-small" onClick={() => void deactivate(m)}>Avaktivera</button>}
                    <button className="btn btn-small" onClick={() => setPending({ kind: "roll-lararen", member: m })}>Gör till lärare</button>
                    <button className="btn btn-small" onClick={() => void exportMember(m)}>Exportera uppgifter</button>
                    <button className="btn btn-danger btn-small" onClick={() => setPending({ kind: "radera", member: m })}>Radera</button>
                  </>
                ) : (
                  <>
                    {m.active && m.userId !== list?.selfId && <button className="btn btn-small" onClick={() => setPending({ kind: "avaktivera-lararen", member: m })}>Avaktivera</button>}
                    {!m.active && <button className="btn btn-small" onClick={() => setPending({ kind: "aktivera-igen", member: m })}>Aktivera igen (ny länk)</button>}
                    {m.active && m.setupPending && <button className="btn btn-small" onClick={() => setPending({ kind: "aktiveringslank", member: m })}>Ny aktiveringslänk</button>}
                    {m.userId !== list?.selfId && <button className="btn btn-small" onClick={() => setPending({ kind: "roll-elev", member: m })}>Gör till elev</button>}
                    {m.userId !== list?.selfId && <button className="btn btn-danger btn-small" onClick={() => setPending({ kind: "radera", member: m })}>Radera</button>}
                  </>
                )}
              </div>
            </li>
          ))}
          {members.length === 0 && list && <li className="text-ink-soft">Inga {mode === "students" ? "elever" : "lärare"} ännu.</li>}
        </ul>
      </section>

      {pending && (
        <ConfirmPanel
          pending={pending}
          selfName={user?.displayName ?? ""}
          onCancel={() => setPending(null)}
          onDone={(result) => {
            setPending(null);
            if (result.card) setIssued(result.card);
            if (result.link) setLink(result.link);
            setNotice(result.notice ?? null);
            void load();
          }}
        />
      )}
    </div>
  );

  async function deactivate(m: Member) {
    setNotice(null);
    const r = await api(`/api/lararen/medlemmar/${m.userId}/avaktivera/`, "POST", {});
    if (!r.ok) setNotice(String(r.data.message ?? "Kunde inte avaktivera."));
    else setNotice(`${m.displayName} är avaktiverad och alla sessioner är avslutade.`);
    void load();
  }
  async function exportMember(m: Member) {
    const r = await api(`/api/lararen/medlemmar/${m.userId}/export/`, "GET");
    if (!r.ok) return setNotice(String(r.data.message ?? "Kunde inte exportera."));
    const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `elevuppgifter-${m.userId.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function ConfirmPanel({ pending, selfName, onCancel, onDone }: { pending: Pending; selfName: string; onCancel: () => void; onDone: (r: { card?: Issued; link?: IssuedLink; notice?: string }) => void }) {
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const member = "member" in pending ? pending.member : null;
  const needsEmail = pending.kind === "roll-lararen" || pending.kind === "skapa-lararen";
  const destructive = pending.kind === "radera";

  const explain: Record<Pending["kind"], string> = {
    "ny-kod": "Den gamla koden blir ogiltig direkt och eleven loggas ut överallt. Den nya koden visas bara en gång.",
    "aktivera-igen": "Kontot aktiveras igen med en ny engångsuppgift. Den visas bara en gång.",
    radera: "Kontot och alla dess framsteg raderas permanent. Det går inte att ångra. En pseudonym spårhändelse (utan namn) finns kvar i säkerhetsloggen.",
    "avaktivera-lararen": "Läraren förlorar all åtkomst direkt och loggas ut. Den sista aktiva läraren kan inte avaktiveras.",
    aktiveringslank: "En ny engångslänk skapas. Äldre länkar slutar fungera.",
    "roll-elev": "Läraren blir elev: förlorar all administratörsåtkomst direkt och får en ny elevkod. Den sista läraren kan inte göras till elev.",
    "roll-lararen": "Eleven blir lärare och får tillgång till gruppens administration först efter att ha satt eget lösenord och registrerat tvåfaktor.",
    "skapa-lararen": "Läraren får en engångslänk för att sätta eget lösenord och registrera tvåfaktor. Utan det får kontot ingen administratörsåtkomst.",
  };

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (destructive && typed.trim() !== member!.displayName) return setErr("Skriv namnet exakt för att bekräfta radering.");
    setBusy(true);
    let r;
    if (pending.kind === "skapa-lararen") r = await api("/api/lararen/larare/", "POST", { displayName: name, loginEmail: email, password });
    else if (pending.kind === "roll-elev" || pending.kind === "roll-lararen") r = await api(`/api/lararen/medlemmar/${member!.userId}/roll/`, "POST", { role: pending.kind === "roll-elev" ? "student" : "teacher", loginEmail: needsEmail ? email : undefined, password });
    else if (pending.kind === "radera") r = await api(`/api/lararen/medlemmar/${member!.userId}/radera/`, "POST", { password });
    else if (pending.kind === "avaktivera-lararen") r = await api(`/api/lararen/medlemmar/${member!.userId}/avaktivera/`, "POST", { password });
    else r = await api(`/api/lararen/medlemmar/${member!.userId}/${pending.kind}/`, "POST", { password });
    setBusy(false);
    if (!r.ok) return setErr(String(r.data.message ?? "Åtgärden misslyckades."));
    const d = r.data;
    const origin = window.location.origin;
    onDone({
      card: d.loginCode ? { name: member?.displayName ?? "", username: String(d.username ?? ""), code: String(d.loginCode), group: String(d.group ?? "") } : undefined,
      link: d.activationPath ? { name: member?.displayName ?? name, url: `${origin}${String(d.activationPath)}`, expires: String(d.expiresAt) } : undefined,
      notice: pending.kind === "radera" ? "Kontot är raderat." : undefined,
    });
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <form onSubmit={run} className="card w-full max-w-lg space-y-3 border-2 border-red" data-testid="confirm-panel">
        <h2 id="confirm-title" className="!text-xl">{titles[pending.kind]}{member ? `: ${member.displayName}` : ""}</h2>
        <p>{explain[pending.kind]}</p>
        {pending.kind === "skapa-lararen" && (
          <>
            <label className="block font-semibold" htmlFor="tn">Lärarens namn</label>
            <input id="tn" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border-2 border-line bg-white p-3" data-testid="teacher-name" />
          </>
        )}
        {needsEmail && (
          <>
            <label className="block font-semibold" htmlFor="te">Lärarens inloggningsnamn (e-postadress)</label>
            <input id="te" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border-2 border-line bg-white p-3" data-testid="teacher-email" />
            <p className="text-sm text-ink-soft">Inget e-postmeddelande skickas. Adressen används bara som inloggningsnamn.</p>
          </>
        )}
        {destructive && (
          <>
            <label className="block font-semibold" htmlFor="typed">Skriv namnet ”{member!.displayName}” för att bekräfta</label>
            <input id="typed" value={typed} onChange={(e) => setTyped(e.target.value)} className="w-full rounded-lg border-2 border-line bg-white p-3" data-testid="confirm-typed" autoComplete="off" />
          </>
        )}
        <label className="block font-semibold" htmlFor="cpw">Bekräfta med ditt lösenord ({selfName})</label>
        <input id="cpw" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border-2 border-line bg-white p-3" data-testid="confirm-password" />
        {err && <p role="alert" className="feedback feedback-wrong" data-testid="confirm-error">{err}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={onCancel} data-testid="confirm-cancel">Avbryt</button>
          <button type="submit" className={`btn ${destructive ? "btn-danger" : "btn-primary"}`} disabled={busy} data-testid="confirm-submit">Bekräfta</button>
        </div>
      </form>
    </div>
  );
}
