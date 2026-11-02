import Link from "next/link";
import { getContent } from "@/lib/content";
import { PhotoRights, PhotoSlot, photosFor } from "@/components/Photo";
import { themePath } from "@/lib/chapters";
import { StartCta, type ChapterLite } from "@/components/StartCta";
import { ThemeCards } from "@/components/ThemeCards";

export default function Home() {
  const { trip, chapters, themes, home } = getContent();
  const lite: ChapterLite[] = chapters.map((c) => ({ id: c.id, slug: c.slug, themeId: c.themeId, status: c.status, title: c.title }));
  const refs = chapters.map((c) => ({ id: c.id, themeId: c.themeId, status: c.status }));
  const cards = themes.slice().sort((a, b) => a.order - b.order).map((t) => ({ id: t.id, order: t.order, title: t.title, href: themePath(t.id) }));

  return (
    <div className="container-page space-y-10 pt-8">
      <section className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <p className="font-semibold text-red">Utbildning om Japan</p>
          <h1>{trip.name}</h1>
          <p className="prose-col text-lg">
            En kurs i korta kapitel som ger dig en grund att stå på: landet och naturen, historia, vardag, språk, hänsyn och mat. Du läser, övar och gör ett kort test, i din egen takt på mobil, surfplatta eller dator.
          </p>
          <StartCta chapters={lite} />
        </div>
        <PhotoSlot role="card" slotId={home.hero.slotId} imageId={home.hero.imageId} brief={home.hero.brief} />
      </section>

      <section aria-labelledby="sa-funkar" className="space-y-3">
        <h2 id="sa-funkar">Så fungerar utbildningen</h2>
        <ol className="grid gap-3 md:grid-cols-4">
          <li className="card">
            <h3>1. Välj ett tema</h3>
            <p>Utbildningen är indelad i {themes.length} teman. Börja med tema 1 eller hoppa till det som intresserar dig mest.</p>
          </li>
          <li className="card">
            <h3>2. Läs och öva</h3>
            <p>Varje kapitel tar cirka 5–8 minuter: kort text, bilder, övningar och något att lägga märke till på resan.</p>
          </li>
          <li className="card">
            <h3>3. Gör testet</h3>
            <p>Fem frågor med förklaringar. Fyra rätt ger ”Klar”, och du kan försöka igen hur många gånger du vill.</p>
          </li>
          <li className="card">
            <h3>4. Följ dina framsteg</h3>
            <p>
              Utan konto sparas de på din enhet. Med konto från din lärare synkas kapitelstatus. <Link href="/info/">Läs mer</Link>
            </p>
          </li>
        </ol>
      </section>

      <section aria-labelledby="teman" className="space-y-3">
        <h2 id="teman">Teman</h2>
        <ThemeCards themes={cards} chapters={refs} />
      </section>

      <PhotoRights photos={photosFor([home.hero.imageId])} />
    </div>
  );
}
