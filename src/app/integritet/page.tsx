import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Integritet" };
export const dynamic = "force-static";

export default function Privacy() {
  return (
    <div className="container-page space-y-8 pt-8">
      <header className="space-y-2">
        <h1>Integritet</h1>
        <p className="prose-col text-lg">
          Du använder utbildningen utan konto. Dina framsteg sparas lokalt i din webbläsare och skickas inte till oss. Webbplatsen har inga annonser eller inbyggda verktyg för besöksstatistik.
        </p>
      </header>

      <section aria-labelledby="lokalt" className="prose-col space-y-2">
        <h2 id="lokalt">Det som sparas på din enhet</h2>
        <p>
          Webbläsaren sparar vilka kapitel du har påbörjat och slutfört, dina bästa och senaste testresultat, pågående test och senast valda tema. Den sparar också information om offlinenedladdning och senaste export.
        </p>
        <p>
          Uppgifterna används för att visa dina framsteg och låta dig fortsätta där du slutade. De finns kvar tills du eller webbläsaren tar bort dem. Om du rensar webbplatsdata, byter webbläsare eller använder privat läge kan framstegen försvinna.
        </p>
        <p>
          Under <Link href="/offline/">Mina framsteg</Link> i menyn hittar du dina framsteg, testresultat och funktioner för nedladdning, säkerhetskopiering och radering.
        </p>
      </section>

      <section aria-labelledby="offline" className="prose-col space-y-2">
        <h2 id="offline">Utbildningen offline</h2>
        <p>När du laddar ned utbildningen sparas sidor, bilder, övningar och test på din enhet. Därefter kan du använda det nedladdade materialet utan internet.</p>
        <p>
          Offlinematerial och framsteg lagras separat. Du kan ta bort utbildningsmaterialet utan att radera dina framsteg och tvärtom. Innehållsuppdateringar raderar inte dina framsteg.
        </p>
        <p>
          På Mina framsteg ser du om utbildningen är nedladdad och om en uppdatering finns. All information om nya versioner och uppdateringar visas där. Du väljer själv när du vill uppdatera.
        </p>
      </section>

      <section aria-labelledby="sakerhetskopia" className="prose-col space-y-2">
        <h2 id="sakerhetskopia">Säkerhetskopiera och flytta framsteg</h2>
        <p>
          På Mina framsteg kan du exportera dina framsteg till en fil. Filen kan sparas som säkerhetskopia eller importeras i en annan webbläsare eller på en annan enhet. Ingen automatisk synkning sker.
        </p>
        <p>
          Exportfilen innehåller dina kapitelframsteg. Förvara den som du själv önskar och dela den bara med personer du vill ska kunna se framstegen. Filen ligger kvar där du sparat den tills du tar bort den.
        </p>
      </section>

      <section aria-labelledby="radera" className="prose-col space-y-2">
        <h2 id="radera">Radera lokala uppgifter</h2>
        <p>
          På Mina framsteg kan du rensa dina framsteg, pågående test och senast valda tema. Där kan du också ta bort offlinenedladdningen separat.
        </p>
        <p>Du kan även rensa webbplatsdata i webbläsarens inställningar. Exportfiler som du har sparat påverkas inte och behöver tas bort separat.</p>
      </section>

      <section aria-labelledby="teknik" className="prose-col space-y-2">
        <h2 id="teknik">Teknisk drift och kakor</h2>
        <p>
          Webbplatsen levereras av Vercel. När du besöker den hanteras tekniska uppgifter, bland annat din IP-adress, för att innehållet ska kunna skickas till din enhet. Vercel kan även behandla tekniska uppgifter för drift, säkerhet och felsökning. Detta är separat från dina lokalt sparade framsteg.
        </p>
        <p>
          Läs mer i{" "}
          <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
            Vercels integritetsinformation
          </a>
          .
        </p>
        <p>Webbplatsen använder inga reklam- eller statistikkakor. Framsteg och inställningar sparas med webbläsarens lokala lagring.</p>
      </section>
    </div>
  );
}
