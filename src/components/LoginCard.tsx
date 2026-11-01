"use client";

/** Individuellt inloggningskort. Visas bara från minnet efter skapandet; koden lagras aldrig av webbläsaren eller databasen. */
export function LoginCard({ group, name, username, code, onClose }: { group: string; name: string; username: string; code: string; onClose: () => void }) {
  return (
    <section aria-labelledby="card-title" className="card space-y-3 border-2 border-red" data-testid="login-card">
      <div className="print-area space-y-2 rounded-lg border-2 border-ink p-4 bg-white text-black">
        <p className="text-xs font-bold uppercase tracking-wide">Japanresan 2027 · {group}</p>
        <h2 id="card-title" className="!text-xl !text-black">Inloggningskort: {name}</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="font-semibold">Webbadress</dt>
          <dd>
            <span data-testid="card-site">{typeof window !== "undefined" ? window.location.origin : ""}</span>/logga-in/
          </dd>
          <dt className="font-semibold">Användarnamn</dt>
          <dd className="font-mono text-lg" data-testid="card-username">{username}</dd>
          <dt className="font-semibold">Inloggningskod</dt>
          <dd className="font-mono text-lg tracking-wider" data-testid="card-code">{code}</dd>
        </dl>
        <p className="text-sm">Förvara kortet säkert och dela det inte. Har du glömt koden ger din lärare dig en ny.</p>
      </div>
      <p className="callout callout-check no-print" role="alert">
        <strong>Koden visas bara nu.</strong> Den sparas inte i läsbar form och går inte att hämta senare. Skriv ut kortet eller kopiera uppgifterna innan du stänger.
      </p>
      <div className="flex flex-wrap gap-2 no-print">
        <button className="btn btn-primary" onClick={() => window.print()} data-testid="card-print">Skriv ut kortet</button>
        <button
          className="btn"
          onClick={() => void navigator.clipboard?.writeText(`Japanresan 2027 – ${name}\nWebbadress: ${window.location.origin}/logga-in/\nAnvändarnamn: ${username}\nInloggningskod: ${code}`)}
          data-testid="card-copy"
        >
          Kopiera uppgifterna
        </button>
        <button className="btn" onClick={onClose} data-testid="card-close">Jag har sparat uppgifterna, stäng</button>
      </div>
    </section>
  );
}
