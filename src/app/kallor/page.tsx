import type { Metadata } from "next";
import Link from "next/link";
import { getContent } from "@/lib/content";

export const metadata: Metadata = { title: "Källor och rättigheter" };

const kindLabel = { official: "Officiell/offentlig", institution: "Institution", "news-or-reference": "Nyhets-/uppslagskälla", "travel-guide": "Reseguide" } as const;
const accessLabel = {
  opened: "Sidan öppnades och lästes",
  "search-result-summary": "Kontrollerad via sammanfattat sökresultat (sidan öppnades inte)",
  "not-checked": "Ej kontrollerad i detta arbete",
} as const;

export default function Sources() {
  const { sources, media, chapters } = getContent();
  const published = chapters.filter((c) => c.status === "published");
  return (
    <div className="container-page space-y-8 pt-8">
      <header className="space-y-2">
        <h1>Källor och rättigheter</h1>
        <p className="prose-col">
          Här finns alla källor som kapitlen hänvisar till. Datumet visar när källan kontrollerades. Källorna har kontrollerats mot sammanfattade sökresultat, och de flesta källsidor har inte öppnats i sin helhet. Kapitlen är ännu inte granskade av en person, så osäkerheter redovisas i varje kapitel.
        </p>
      </header>

      <section aria-labelledby="kapitel" className="space-y-3">
        <h2 id="kapitel">Per kapitel</h2>
        <ul className="space-y-2">
          {published.map((c) => (
            <li key={c.id} className="card !p-3">
              <p className="font-semibold">
                <Link href={`/kapitel/${c.slug}/`}>{c.title}</Link>
              </p>
              <p className="text-sm">
                Kontrolldatum {c.status === "published" && c.review.reviewedOn} · {c.status === "published" && (c.review.status === "human-reviewed" ? "granskad av person" : "behöver granskas av person")} · {c.status === "published" && c.sourceIds.length} källor
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="alla" className="space-y-3">
        <h2 id="alla">Alla källor</h2>
        <ul className="space-y-3">
          {sources.map((s) => (
            <li key={s.id} className="card">
              <p className="font-semibold">
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.title}
                </a>
              </p>
              <p>
                {s.publisher} · {kindLabel[s.kind]}
              </p>
              <p className="text-sm">
                Kontrolldatum: {s.checkedOn}. {accessLabel[s.access]}.
              </p>
              <p className="text-sm text-ink-soft">Stöder: {s.supports}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="bilder" className="space-y-3">
        <h2 id="bilder">Bilder och rättigheter</h2>
        <ul className="space-y-3">
          {media.map((m) => (
            <li key={m.id} className="card">
              <p className="font-semibold">{m.id}</p>
              <p>{m.alt}</p>
              <p className="text-sm">Upphov: {m.rights.creator}</p>
              <p className="text-sm">Licens: {m.rights.license}</p>
              <p className="text-sm text-ink-soft">{m.rights.note}</p>
            </li>
          ))}
        </ul>
        <p className="text-sm text-ink-soft">Alla övriga grafiska element (ikoner, färger) är egna och utan tredjepartsmaterial.</p>
      </section>

      <section aria-labelledby="osakert" className="card prose-col space-y-2">
        <h2 id="osakert">Stabilt och föränderligt</h2>
        <p>Kapitlen skiljer mellan stabil bakgrundskunskap (till exempel geografi och historiska huvuddrag) och uppgifter som måste kontrolleras nära avresa (priser, inreseregler, öppettider, tidtabeller, lokala regler). Inga sådana uppgifter ska ses som garanterade för oktober 2027.</p>
      </section>
    </div>
  );
}
