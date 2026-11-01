import Link from "next/link";
import { getContent } from "@/lib/content";
import { ContinueCard, type ChapterLite } from "@/components/ContinueCard";

const monthNames = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];

export default function Home() {
  const { trip, chapters, themes } = getContent();
  const [y, m] = trip.departureMonth.split("-").map(Number);
  const published = chapters.filter((c) => c.status === "published");
  const first = published[0];
  const lite: ChapterLite[] = chapters.map((c) => ({
    id: c.id,
    slug: c.slug,
    themeId: c.themeId,
    status: c.status,
    title: c.title,
    minutes: c.status === "published" ? c.minutes : undefined,
  }));

  return (
    <div className="container-page space-y-10 pt-8">
      <section className="space-y-4">
        <p className="font-semibold text-red">Förberedelse inför skolresan</p>
        <h1>{trip.name}</h1>
        <p className="prose-col text-lg">
          Korta kapitel, övningar och test som hjälper dig att förstå Japan lite bättre innan avresan: historia, vardag, språk, hänsyn och mat. Du gör det i din egen takt, på mobil, surfplatta eller dator.
        </p>
        <dl className="card grid gap-x-8 gap-y-1 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">Avresa</dt>
          <dd>
            {monthNames[m - 1]} {y} (exakt datum är inte bestämt)
          </dd>
          <dt className="font-semibold">Grupp</dt>
          <dd>
            {trip.audience.students} elever och {trip.audience.teachers} lärare
          </dd>
          <dt className="font-semibold">Resmål</dt>
          <dd>{trip.destinations.length ? trip.destinations.join(", ") : "Inte beslutade än"}</dd>
        </dl>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="borja" className="card flex flex-col gap-3">
          <h2 id="borja">Börja här</h2>
          <p>Ny här? Starta med det första kapitlet. Varje kapitel tar cirka 5–8 minuter inklusive test, och alla färdiga kapitel är öppna från början.</p>
          <Link className="btn btn-primary self-start" href={`/kapitel/${first.slug}/`}>
            Starta: {first.title}
          </Link>
        </section>
        <ContinueCard chapters={lite} />
      </div>

      <section aria-labelledby="sa-funkar" className="space-y-3">
        <h2 id="sa-funkar">Så fungerar det</h2>
        <ol className="grid gap-3 md:grid-cols-3">
          <li className="card">
            <h3>1. Läs och pröva</h3>
            <p>Kort text med mellanrubriker, övningar att prova och något att lägga märke till på resan.</p>
          </li>
          <li className="card">
            <h3>2. Gör testet</h3>
            <p>Fem frågor med förklaringar till alla svar. Fyra rätt ger ”Klar”. Du kan försöka igen hur många gånger du vill.</p>
          </li>
          <li className="card">
            <h3>3. Följ ditt resepass</h3>
            <p>Se framsteg per tema, favoriter och bästa resultat. Spara dem med export.</p>
          </li>
        </ol>
      </section>

      <section aria-labelledby="innehall-oversikt" className="card space-y-2">
        <h2 id="innehall-oversikt">Vad finns i piloten?</h2>
        <p>
          Utbildningen är planerad i {themes.length} teman med {chapters.length} kapitel. I den här pilotversionen är <strong>{published.length} kapitel färdiga</strong>. De övriga {chapters.length - published.length} har titel, mål och beskrivning, men är markerade <span className="badge badge-planned">Kommer senare</span> och har inget innehåll än.
        </p>
        <p>
          <Link href="/utbildning/">Se hela utbildningsöversikten</Link>
        </p>
      </section>

      <section aria-labelledby="sparas" className="card space-y-2">
        <h2 id="sparas">Dina framsteg sparas på din enhet</h2>
        <p>
          Här finns inga konton. Framstegen sparas i webbläsaren på just den här enheten, kan försvinna om du rensar webbdata och synkas inte mellan enheter. Exportera dem då och då. <Link href="/info/">Läs mer, och hur du gör utbildningen tillgänglig offline.</Link>
        </p>
      </section>
    </div>
  );
}
