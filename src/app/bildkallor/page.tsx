import type { Metadata } from "next";
import Link from "next/link";
import { getContent } from "@/lib/content";
import { chapterPath } from "@/lib/chapters";
import { PhotoCredit, PhotoPicture } from "@/components/Photo";

export const metadata: Metadata = { title: "Bildkällor" };

export default function ImageSources() {
  const { photos, chapters, home } = getContent();
  const slotCount =
    1 + chapters.reduce((n, c) => n + (c.status === "published" ? 1 + c.sections.flatMap((s) => s.blocks).filter((b) => b.type === "photo").length : 0), 0);
  const pending =
    (home.hero.imageId ? 0 : 1) +
    chapters.reduce((n, c) => n + (c.status === "published" ? (c.hero.imageId ? 0 : 1) + c.sections.flatMap((s) => s.blocks).filter((b) => b.type === "photo" && !b.imageId).length : 0), 0);
  const where = (id: string) => {
    if (id === "home") return <Link href="/" className="inline-block py-1">Startsidan</Link>;
    const c = chapters.find((x) => x.id === id);
    return c ? <Link href={chapterPath(c)} className="inline-block py-1">{c.title}</Link> : id;
  };
  return (
    <div className="container-page space-y-8 pt-8">
      <header className="space-y-2">
        <h1>Bildkällor</h1>
        <p className="prose-col">
          Här finns alla fotografier som används i utbildningen, med fotograf, licens och länk till originalets informationssida. Kodens licens omfattar inte fotografierna: varje bild har sin egen licens.
        </p>
      </header>

      {pending > 0 && photos.length > 0 && (
        <p className="callout callout-check prose-col" data-testid="pending-slots">
          {pending} av {slotCount} bildplatser saknar ännu fotografi och visar en reservyta med planerat motiv.
        </p>
      )}
      {photos.length === 0 ? (
        <section className="card prose-col space-y-2" data-testid="no-photos">
          <h2 className="!text-xl">Inga fotografier är valda än</h2>
          <p>
            Utbildningen har {slotCount} bildplatser (startsidan och kapitlen), men inget fotografi har ännu valts och rättighetskontrollerats. Tills vidare visas reservytor med planerat motiv. Inga bilder används utan fullständigt licensunderlag.
          </p>
          <p className="text-sm text-ink-soft">Startsidans bildplats: {home.hero.brief}</p>
        </section>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2">
          {photos.map((p) => (
            <li key={p.id} id={p.id} className="card space-y-2 scroll-mt-4">
              <div className="aspect-[3/2] overflow-hidden rounded-lg bg-paper-2">
                <PhotoPicture photo={p} role="card" />
              </div>
              <p className="font-semibold">{p.caption}</p>
              <PhotoCredit photo={p} />
              <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="font-semibold">Fotograf/upphov</dt>
                <dd>{p.creator}</dd>
                <dt className="font-semibold">Licens</dt>
                <dd>
                  <a href={p.license.url} target="_blank" rel="noopener noreferrer">
                    {p.license.name}
                  </a>
                </dd>
                <dt className="font-semibold">Original</dt>
                <dd>
                  <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {p.sourceUrl}
                  </a>
                </dd>
                <dt className="font-semibold">Rättighetskontroll</dt>
                <dd>
                  {p.rightsCheckedOn}. Licensen är avläst på originalsidan, ingen juridisk granskning.
                </dd>
                {p.location && (
                  <>
                    <dt className="font-semibold">Plats</dt>
                    <dd>{p.location.value}</dd>
                  </>
                )}
                {p.year && (
                  <>
                    <dt className="font-semibold">År</dt>
                    <dd>{p.year.value}</dd>
                  </>
                )}
                <dt className="font-semibold">Bearbetning</dt>
                <dd>{p.modification}</dd>
                <dt className="font-semibold">Används i</dt>
                <dd>
                  <ul className="list-disc pl-5">
                    {p.usedIn.map((u) => (
                      <li key={u}>{where(u)}</li>
                    ))}
                  </ul>
                </dd>
              </dl>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-ink-soft">
        Egen grafik, till exempel kartan, redovisas under <Link href="/kallor/#bilder">Källor och rättigheter</Link>.
      </p>
    </div>
  );
}
