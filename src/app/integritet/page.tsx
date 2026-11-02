import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Integritet" };
export const dynamic = "force-static";

/** Värdena sätts av skolan (miljövariabler vid bygget). Inget förvalt värde hittas på. */
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
        <h1>Integritet</h1>
        <p className="prose-col text-lg">Du kan använda utbildningen utan konto. Här står vad som sparas om du har ett konto, och vad som sparas på din enhet.</p>
      </header>

      {missing && (
        <p className="callout callout-check prose-col" role="note" data-testid="privacy-todo">
          Uppgifter markerade ”{TBD}” beslutas av skolan och är inte klara än.
        </p>
      )}

      <section aria-labelledby="sparas" className="prose-col space-y-2">
        <h2 id="sparas">Vad sparas, och varför</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Konto:</strong> ett förnamn eller alias, ett slumpat användarnamn och en inloggningskod som bara sparas som ett oläsbart avtryck. Det behövs för att du ska kunna logga in och för att din lärare ska känna igen dig.
          </li>
          <li>
            <strong>Framsteg:</strong> vilka kapitel du påbörjat och klarat, när, och när de senast synkades. Det behövs för att din status ska följa med dig och för att läraren ska kunna följa gruppen.
          </li>
          <li>
            <strong>Säkerhetslogg:</strong> när konton skapas, koder byts eller roller ändras, utan namn och koder. Den behövs för att kunna reda ut fel och missbruk.
          </li>
          <li>
            <strong>Lärare:</strong> en e-postadress som används som inloggningsnamn (ingen e-post skickas), ett lösenord (tvåfaktor är valfritt).
          </li>
        </ul>
        <p>
          Vi sparar inte dina svar, felaktiga svar, antal försök, lästid, klick eller reflektioner. Inte heller efternamn, personnummer, födelsedatum, telefonnummer, hälsouppgifter eller annat känsligt. Skriv inte sådant i tjänsten. Det finns inga annonser, inga spårare och inga topplistor.
        </p>
        <p>Uppgifterna är pseudonymiserade, inte anonyma: din lärare vet vem som hör till ett användarnamn.</p>
      </section>

      <section aria-labelledby="vem" className="prose-col space-y-2">
        <h2 id="vem">Vem kan se dem</h2>
        <p>
          Lärarna i din grupp ser ditt visningsnamn, användarnamn, vilka kapitel du påbörjat och klarat och när du senast synkade. Andra elever ser ingenting om dig. Din inloggningskod kan ingen läsa, men läraren kan ge dig en ny.
        </p>
      </section>

      <section aria-labelledby="radering" className="prose-col space-y-2">
        <h2 id="radering">Hur länge, och radering</h2>
        <p>
          Hur länge uppgifterna sparas bestäms av skolan: <strong>{cfg.retention ?? TBD}</strong>.
        </p>
        <p>
          Din lärare kan avaktivera ditt konto, exportera de uppgifter som sparas om dig och radera kontot. Efter radering kan uppgifterna finnas kvar i säkerhetskopior en begränsad tid, och säkerhetsloggen sparar bara ett internt nummer, inte ditt namn.
        </p>
      </section>

      <section aria-labelledby="lokalt" className="prose-col space-y-2">
        <h2 id="lokalt">Kakor och lagring på din enhet</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Kakor:</strong> bara en säkerhetskaka som håller dig inloggad. Inga kakor för statistik eller reklam.
          </li>
          <li>
            <strong>Utan konto</strong> sparas dina framsteg och ditt senast valda tema i webbläsaren på den här enheten.
          </li>
          <li>
            <strong>Med konto</strong> lämnas som standard inget personligt kvar på enheten när du loggar ut eller stänger fliken. På din egen enhet kan du välja att spara framsteg lokalt för att arbeta offline. Välj inte det på en delad dator. Utloggning rensar uppgifterna, och vi varnar först om något inte hunnit synkas.
          </li>
          <li>Framsteg som görs utan internet är en hjälp för dig, inte ett säkert underlag för betyg. Inloggning och lärarsidor kräver alltid internet.</li>
        </ul>
      </section>

      <section aria-labelledby="kontakt" className="prose-col space-y-2">
        <h2 id="kontakt">Frågor och dina rättigheter</h2>
        <p>Du kan be om att få veta vad som sparas om dig, begära rättelse eller radering och invända. Vänd dig först till din lärare, eller till kontakten nedan.</p>
        <dl className="card grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]" data-testid="privacy-controller">
          <dt className="font-semibold">Personuppgiftsansvarig</dt>
          <dd>{cfg.controller ?? TBD}</dd>
          <dt className="font-semibold">Kontakt</dt>
          <dd>{cfg.contact ?? TBD}</dd>
          <dt className="font-semibold">Dataskyddsombud</dt>
          <dd>{cfg.dpo ?? TBD}</dd>
        </dl>
      </section>

      <p className="prose-col text-sm text-ink-soft">
        <Link href="/info/">Så sparas dina framsteg och hur offline fungerar</Link>
      </p>
    </div>
  );
}
