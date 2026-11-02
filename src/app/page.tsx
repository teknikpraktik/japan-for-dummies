import Link from "next/link";
import { getContent } from "@/lib/content";
import { CardThumb, PhotoRights, PhotoSlot, photosFor } from "@/components/Photo";
import { chapterPath } from "@/lib/chapters";
import { ContinueCard, type ChapterLite } from "@/components/ContinueCard";

export default function Home() {
  const { trip, chapters, home } = getContent();
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
      </section>

      <PhotoSlot role="hero" priority slotId={home.hero.slotId} imageId={home.hero.imageId} brief={home.hero.brief} />

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

      <section aria-labelledby="pilotkapitel" className="space-y-3">
        <h2 id="pilotkapitel">De färdiga kapitlen</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {published.map((c) =>
            c.status === "published" ? (
              <li key={c.id} className="card flex flex-col gap-2">
                <CardThumb imageId={c.hero.imageId} />
                <h3>
                  <Link href={chapterPath(c)}>{c.title}</Link>
                </h3>
                <p className="text-sm text-ink-soft">Cirka {c.minutes} min</p>
              </li>
            ) : null,
          )}
        </ul>
      </section>

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
            <p>Se framsteg per tema och bästa resultat. Spara dem med export.</p>
          </li>
        </ol>
      </section>

      <section aria-labelledby="sparas" className="card space-y-2">
        <h2 id="sparas">Dina framsteg sparas på din enhet</h2>
        <p>
          Du kan använda utbildningen utan konto: då sparas framstegen i webbläsaren på just den här enheten och kan försvinna om du rensar webbdata. Elever med konto från sin lärare kan <Link href="/logga-in/">logga in</Link> för att synka kapitelstatus. Exportera framstegen då och då. <Link href="/info/">Läs mer, och hur du gör utbildningen tillgänglig offline.</Link>
        </p>
      </section>
      <PhotoRights photos={photosFor([home.hero.imageId])} />
    </div>
  );
}
