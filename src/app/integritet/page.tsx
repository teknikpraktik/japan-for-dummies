import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Integritet" };
export const dynamic = "force-static";

/** Kontaktuppgift sätts av ansvarig (miljövariabel vid bygget). Inget förvalt värde hittas på. */
const contact = process.env.PRIVACY_CONTACT;

export default function Privacy() {
  return (
    <div className="container-page space-y-8 pt-8">
      <header className="space-y-2">
        <h1>Integritet</h1>
        <p className="prose-col text-lg">Du behöver inget konto för att använda utbildningen. Dina framsteg sparas i din egen webbläsare och skickas inte till tjänsten.</p>
      </header>

      <section aria-labelledby="lokalt" className="prose-col space-y-2">
        <h2 id="lokalt">Det som sparas på din enhet</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Vilka kapitel du påbörjat och klarat, dina testresultat och ett pågående test, så att du kan fortsätta där du slutade.</li>
          <li>Vilket tema du senast tittade på och om du har laddat ned utbildningen för offline.</li>
        </ul>
        <p>Det ligger i webbläsarens lokala lagring på den här enheten. Det följer inte med till andra enheter och kan försvinna om du rensar webbplatsdata, byter webbläsare eller använder privat läge.</p>
      </section>

      <section aria-labelledby="offline" className="prose-col space-y-2">
        <h2 id="offline">Offlinenedladdning</h2>
        <p>Om du väljer att ladda ned utbildningen sparas sidor, bilder och övningar i webbläsarens cache på din enhet, så att de fungerar utan internet. Det är bara utbildningsmaterial och innehåller inga uppgifter om dig. Storleken visas på sidan <Link href="/offline/">Min utbildning</Link>.</p>
      </section>

      <section aria-labelledby="rensa" className="prose-col space-y-2">
        <h2 id="rensa">Så rensar du</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            På <Link href="/offline/">Min utbildning</Link> kan du rensa dina lokala framsteg och ta bort offlinenedladdningen.
          </li>
          <li>Du kan också rensa webbplatsdata för den här adressen i webbläsarens inställningar.</li>
          <li>En exportfil som du själv sparat ligger kvar tills du tar bort den.</li>
        </ul>
      </section>

      <section aria-labelledby="teknik" className="prose-col space-y-2">
        <h2 id="teknik">Teknisk loggning och kakor</h2>
        <p>
          Webbplatsen driftas hos Vercel. Driftleverantörens servrar kan logga tekniska uppgifter om varje anrop, till exempel tid, adress, IP-adress och webbläsartyp, för drift, säkerhet och felsökning. Hur länge sådana loggar sparas styr leverantören själv, och det har inte kontrollerats närmare här.
        </p>
        <p>Vi har inte lagt in någon statistik, några annonser eller några spårare. Sidorna sätter inga kakor; lokal lagring används i stället för det som beskrivs ovan.</p>
      </section>

      <section aria-labelledby="ansvar" className="prose-col space-y-2">
        <h2 id="ansvar">Ansvarig och kontakt</h2>
        <p>Per Björkman ansvarar för den behandling han bestämmer över i den här fristående tjänsten.</p>
        <dl className="card grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]" data-testid="privacy-controller">
          <dt className="font-semibold">Ansvarig</dt>
          <dd>Per Björkman</dd>
          <dt className="font-semibold">Kontakt</dt>
          <dd>{contact ?? "Kontaktuppgift är inte angiven än"}</dd>
        </dl>
      </section>
    </div>
  );
}
