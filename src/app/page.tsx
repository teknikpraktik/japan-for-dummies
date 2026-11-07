import { getContent } from "@/lib/content";
import { StartCredit, StartHero } from "@/components/StartHeroServer";
import { themePath } from "@/lib/chapters";
import { StartCta, type ChapterLite } from "@/components/StartCta";
import { ThemeCards } from "@/components/ThemeCards";
import { LocalNotice } from "@/components/LocalNotice";

export default function Home() {
  const { chapters, themes } = getContent();
  const lite: ChapterLite[] = chapters.map((c) => ({ id: c.id, slug: c.slug, themeId: c.themeId, status: c.status, title: c.title }));
  const refs = chapters.map((c) => ({ id: c.id, themeId: c.themeId, status: c.status }));
  const cards = themes.slice().sort((a, b) => a.order - b.order).map((t) => ({ id: t.id, order: t.order, title: t.title, href: themePath(t.id) }));

  return (
    <div className="container-page space-y-8 pt-8">
      <section className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-4">
          <h1>Japan börjar här</h1>
          <p className="prose-col text-lg">
            En kurs i korta kapitel som ger dig en grund att stå på: landet och naturen, historia, vardag, språk, hänsyn och mat. Du läser, övar och gör ett kort test, i din egen takt på mobil, surfplatta eller dator.
          </p>
          <StartCta chapters={lite} firstThemeId={cards[0].id} />
        </div>
        <StartHero />
      </section>

      <section aria-labelledby="sa-funkar" className="space-y-3">
        <h2 id="sa-funkar">Så fungerar utbildningen</h2>
        <ol className="grid gap-x-6 gap-y-3 md:grid-cols-3">
          {[
            ["Välj tema", "Börja från början eller välj det som intresserar dig."],
            ["Läs och öva", "Korta kapitel med text, bilder och övningar."],
            ["Testa dig", "Svara på frågor och få förklaringar till svaren."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-soft font-bold text-indigo-dark">
                {i + 1}
              </span>
              <p>
                <strong className="block">{t}</strong>
                {d}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="teman" className="space-y-3">
        <h2 id="teman">Teman</h2>
        <ThemeCards themes={cards} chapters={refs} />
        <LocalNotice />
      </section>

      <StartCredit />
    </div>
  );
}
