import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Integritet" };
export const dynamic = "force-static";

/** Värdena nedan sätts av skolan (miljövariabler vid bygget). Inget förvalt värde hittas på. */
const cfg = {
  controller: process.env.PRIVACY_CONTROLLER_NAME,
  contact: process.env.PRIVACY_CONTACT,
  dpo: process.env.PRIVACY_DPO_CONTACT,
  retention: process.env.PRIVACY_RETENTION_POLICY,
};
const TBD = "Ej fastställt av skolan än";

export default function Privacy() {
  const missing = !cfg.controller || !cfg.contact || !cfg.retention;
  return (
    <div className="container-page space-y-8 pt-8">
      <header className="space-y-2">
        <h1>Integritet och dina uppgifter</h1>
        <p className="prose-col text-lg">Här står vad tjänsten sparar om dig, varför, vem som kan se det och hur du når oss. Vi försöker spara så lite som möjligt.</p>
      </header>

      {missing && (
        <p className="callout callout-check prose-col" role="note" data-testid="privacy-todo">
          <strong>Obs:</strong> Uppgifter markerade ”{TBD}” måste fastställas av skolan innan tjänsten används med riktiga elevuppgifter. Till dess används tjänsten bara med syntetiska konton.
        </p>
      )}

      <section aria-labelledby="vad" className="prose-col space-y-3">
        <h2 id="vad">Vad sparas, och varför?</h2>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabell över lagrade uppgifter, rulla i sidled vid behov">
          <table className="w-full min-w-[32rem] border-collapse text-left">
            <caption className="sr-only">Uppgifter som sparas</caption>
            <thead>
              <tr className="border-b-2 border-line"><th scope="col" className="py-2 pr-3">Uppgift</th><th scope="col" className="py-2">Varför</th></tr>
            </thead>
            <tbody>
              {[
                ["Förnamn eller alias (visningsnamn)", "Så att din lärare känner igen dig i listan. Det behöver inte vara ditt riktiga namn och måste inte vara unikt."],
                ["Slumpat användarnamn", "För att logga in. Det bygger inte på ditt namn."],
                ["Inloggningskod (sparas bara som ett oläsbart avtryck)", "För att logga in. Ingen kan läsa din kod, inte ens läraren. Är den borta får du en ny."],
                ["Vilka kapitel du påbörjat och klarat, när du klarade dem och vilken kapitelversion", "Så att din lärare kan följa gruppens framsteg."],
                ["När dina framsteg senast synkades", "För att synkningen ska fungera och så att läraren ser om något inte kommit fram. Det är inte en övervakning av när du läser."],
                ["Inloggningssession (en säkerhetscookie)", "För att hålla dig inloggad. Ingen annan cookie används."],
                ["Säkerhetslogg över kontoändringar (vem gjorde vad och när, utan namn och koder)", "För att kunna reda ut fel och missbruk, till exempel när en kod återställts eller en roll ändrats."],
              ].map(([a, b]) => (
                <tr key={a} className="border-b border-line align-top"><th scope="row" className="py-2 pr-3 font-normal">{a}</th><td className="py-2">{b}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>Lärare har dessutom en e-postadress som används som inloggningsnamn (ingen e-post skickas), ett lösenord (sparas som ett oläsbart avtryck) och tvåfaktorsinloggning (hemligheten och återställningskoderna sparas krypterade).</p>
      </section>

      <section aria-labelledby="inte" className="prose-col space-y-2">
        <h2 id="inte">Vad sparas inte?</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Dina svar på övningar och test, och vilka frågor du svarat fel på.</li>
          <li>Hur många gånger du försökt, hur länge du läst och vad du klickat på.</li>
          <li>Dina egna tankar och reflektioner.</li>
          <li>Efternamn, personnummer, födelsedatum, telefonnummer eller e-postadress (för elever).</li>
          <li>Uppgifter om hälsa, allergier, stödbehov eller skyddad identitet. Skriv inte sådant i tjänsten.</li>
        </ul>
        <p>Inga annonser, inga spårare för marknadsföring, inga offentliga profiler och inga topplistor.</p>
      </section>

      <section aria-labelledby="vem" className="prose-col space-y-2">
        <h2 id="vem">Vem kan se vad?</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Lärarna i din grupp</strong> kan se ditt visningsnamn och användarnamn, vilka kapitel du påbörjat och klarat, och när du senast synkade.</li>
          <li><strong>Andra elever</strong> kan inte se dina uppgifter.</li>
          <li>Lärare kan skapa och avaktivera konton, ge dig en ny kod, exportera de uppgifter som sparas om dig och radera ditt konto.</li>
        </ul>
        <p>Uppgifterna är <strong>pseudonymiserade, inte anonyma</strong>: din lärare vet vem som hör till ett användarnamn.</p>
      </section>

      <section aria-labelledby="lokalt" className="prose-col space-y-2">
        <h2 id="lokalt">Lagring på din enhet och synkning</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Din status sparas centralt på ditt konto och synkas när du är online.</li>
          <li>Dina resultat och favoriter finns bara på enheten. Som standard lämnas <strong>inget personligt kvar</strong> när du loggar ut eller stänger fliken.</li>
          <li>På din <strong>egen</strong> enhet kan du välja att spara framsteg lokalt för att arbeta offline. Välj inte det på en delad dator.</li>
          <li>Utloggning rensar dina lokala uppgifter. Om du har framsteg som inte synkats varnar vi dig först, och du kan avbryta.</li>
          <li>Framsteg som görs utan internet är en bekvämlighet för dig. De är inte ett manipulationssäkert underlag för betyg.</li>
          <li>Inloggning och administration kräver alltid internet. Sidor för lärare och elevlistor sparas aldrig offline.</li>
        </ul>
      </section>

      <section aria-labelledby="ratt" className="prose-col space-y-2">
        <h2 id="ratt">Dina rättigheter och kontakt</h2>
        <p>Du har rätt att få veta vilka uppgifter som sparas om dig, begära rättelse och radering, och invända. Vänd dig till din lärare, som kan exportera och radera uppgifterna, eller direkt till skolan.</p>
        <dl className="card grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]" data-testid="privacy-controller">
          <dt className="font-semibold">Personuppgiftsansvarig</dt>
          <dd>{cfg.controller ?? TBD}</dd>
          <dt className="font-semibold">Kontakt för frågor och rättigheter</dt>
          <dd>{cfg.contact ?? TBD}</dd>
          <dt className="font-semibold">Dataskyddsombud</dt>
          <dd>{cfg.dpo ?? TBD}</dd>
          <dt className="font-semibold">Hur länge uppgifterna sparas</dt>
          <dd>{cfg.retention ?? TBD}</dd>
        </dl>
      </section>

      <p className="prose-col text-sm text-ink-soft">
        <Link href="/kallor/">Källor</Link> · <Link href="/info/">Så sparas dina framsteg och offlinefunktionen</Link>
      </p>
    </div>
  );
}
