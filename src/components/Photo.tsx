import Link from "next/link";
import type { Photo, ImageVariant } from "@/lib/schema";
import { getContent } from "@/lib/content";

const kindLabel: Record<Photo["kind"], string> = {
  "contemporary-photo": "Nutida fotografi",
  "historical-original": "Historiskt original",
  reconstruction: "Rekonstruktion",
  "object-photo": "Föremål (fotografi)",
};

export type PhotoRole = "hero" | "figure" | "card" | "thumb";

const frame: Record<PhotoRole, string> = {
  hero: "aspect-[4/3] sm:aspect-[16/9]",
  figure: "aspect-[4/3] sm:aspect-[3/2]",
  card: "aspect-[3/2]",
  thumb: "aspect-[4/3] sm:aspect-[3/2]",
};
/** Hur bredden används, så att webbläsaren väljer lagom stor fil. */
const sizes: Record<PhotoRole, string> = {
  hero: "(min-width: 1024px) 992px, 100vw",
  figure: "(min-width: 768px) 672px, 100vw",
  card: "(min-width: 768px) 384px, 100vw",
  thumb: "(min-width: 640px) 176px, 112px",
};

const srcSet = (vs: ImageVariant[]) => vs.map((v) => `${v.path} ${v.width}w`).join(", ");

export function findPhoto(id: string | null): Photo | undefined {
  return id ? getContent().photos.find((p) => p.id === id) : undefined;
}

/** Själva bilden: <picture> med AVIF/WebP, mobilbeskärning, fasta mått och fokuspunkt. */
export function PhotoPicture({ photo, role, priority = false }: { photo: Photo; role: PhotoRole; priority?: boolean }) {
  const byCrop = (crop: ImageVariant["crop"], format: ImageVariant["format"]) =>
    photo.variants.filter((v) => v.crop === crop && v.format === format).sort((a, b) => a.width - b.width);
  const defaults = byCrop("default", "webp");
  const fallbackList = defaults.length ? defaults : photo.variants.filter((v) => v.crop === "default").sort((a, b) => a.width - b.width);
  const largest = fallbackList[fallbackList.length - 1];
  const mobile = [...byCrop("mobile", "avif"), ...byCrop("mobile", "webp")];
  const avif = byCrop("default", "avif");
  const fp = `${Math.round(photo.focus.x * 100)}% ${Math.round(photo.focus.y * 100)}%`;
  return (
    <picture>
      {byCrop("mobile", "avif").length > 0 && <source media="(max-width: 639px)" type="image/avif" srcSet={srcSet(byCrop("mobile", "avif"))} sizes={role === "thumb" ? sizes.thumb : "100vw"} />}
      {byCrop("mobile", "webp").length > 0 && <source media="(max-width: 639px)" type="image/webp" srcSet={srcSet(byCrop("mobile", "webp"))} sizes={role === "thumb" ? sizes.thumb : "100vw"} />}
      {avif.length > 0 && <source type="image/avif" srcSet={srcSet(avif)} sizes={sizes[role]} />}
      <img
        src={largest.path}
        srcSet={srcSet(fallbackList)}
        sizes={sizes[role]}
        width={largest.width}
        height={largest.height}
        alt={photo.decorative ? "" : photo.alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        {...(priority ? { fetchPriority: "high" as const } : {})}
        className="h-full w-full object-cover"
        style={{ objectPosition: fp }}
        data-mobile-variants={mobile.length || undefined}
      />
    </picture>
  );
}

export function PhotoCredit({ photo }: { photo: Photo }) {
  return (
    <p className="text-xs text-ink-soft" data-testid="photo-credit">
      <span>{kindLabel[photo.kind]}. </span>
      {photo.requiredCredit ? <span>{photo.requiredCredit} </span> : <span>Foto: {photo.creator}. </span>}
      <a href={photo.license.url} target="_blank" rel="noopener noreferrer">
        {photo.license.name}
      </a>
      {" · "}
      <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">
        Originalet
      </a>
      {" · "}
      <Link href={`/bildkallor/#${photo.id}`}>Bildkällor</Link>
    </p>
  );
}

/** En bildplats: visar fotografiet om det är valt. Utan valt foto visas ingenting. */
export function PhotoSlot({
  role,
  slotId,
  imageId,
  priority,
}: {
  role: PhotoRole;
  slotId: string;
  imageId: string | null;
  brief: string;
  priority?: boolean;
}) {
  const photo = findPhoto(imageId);
  if (!photo) return null;
  return (
    <figure className="space-y-2" data-slot-state="filled" id={`bild-${slotId}`}>
      <div className={`${frame[role]} overflow-hidden rounded-xl bg-paper-2`}>
        <PhotoPicture photo={photo} role={role} priority={priority} />
      </div>
      <figcaption className="text-sm text-ink-soft">{photo.caption}</figcaption>
    </figure>
  );
}

/** Miniatyr för kapitelkort (återanvänder kapitlets öppningsbild). Visas bara när fotografiet finns. */
export function CardThumb({ imageId }: { imageId: string | null }) {
  const photo = findPhoto(imageId);
  if (!photo) return null;
  return (
    <div className={`${frame.card} overflow-hidden rounded-lg bg-paper-2`} data-testid="card-thumb">
      <PhotoPicture photo={{ ...photo, decorative: true }} role="card" />
    </div>
  );
}

/** Liten bild för kompakta kapitelkort: fast bildformat, beskärning med fokuspunkt, aldrig förvrängd. */
export function ChapterThumb({ imageId }: { imageId: string | null }) {
  const photo = findPhoto(imageId);
  const box = `${frame.thumb} w-28 shrink-0 overflow-hidden rounded-lg bg-paper-2 sm:w-44`;
  if (!photo) return null;
  return (
    <div className={box} data-testid="card-thumb">
      <PhotoPicture photo={{ ...photo, decorative: true }} role="thumb" />
    </div>
  );
}

export const platformName: Record<Photo["sourcePlatform"], string> = {
  unsplash: "Unsplash",
  pexels: "Pexels",
  "wikimedia-commons": "Wikimedia Commons",
  "official-japan": "Officiell källa",
  other: "Källa",
};

/** Fotografier som används på en sida, i den ordning de förekommer (utan dubbletter). */
export function photosFor(ids: (string | null | undefined)[]): Photo[] {
  const seen = new Set<string>();
  const out: Photo[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    const p = findPhoto(id);
    if (p) {
      seen.add(id);
      out.push(p);
    }
  }
  return out;
}

/**
 * Kompakt rättighetsavsnitt för en sida: motiv, sedan ”Fotograf · Källa · Licens” med länkar.
 * Licensernas krav på namn, licens och länk till licensen uppfylls här i stället för under varje bild.
 */
export function PhotoRights({ photos, media = [] }: { photos: Photo[]; media?: { id: string; caption: string; rights: { creator: string; license: string } }[] }) {
  if (photos.length === 0 && media.length === 0) return null;
  return (
    <section aria-labelledby="bilder-rattigheter" className="prose-col space-y-2" data-testid="photo-rights">
      <h2 id="bilder-rattigheter" className="!text-sm !font-semibold text-ink-soft">
        Bilder och rättigheter
      </h2>
      <ul className="space-y-1.5 text-sm text-ink-soft">
        {photos.map((p) => (
          <li key={p.id} data-testid={`rights-${p.id}`}>
            {p.creator} ·{" "}
            <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">
              {platformName[p.sourcePlatform]}
            </a>{" "}
            ·{" "}
            <a href={p.license.url} target="_blank" rel="noopener noreferrer">
              {p.license.name}
            </a>
          </li>
        ))}
        {media.map((m) => (
          <li key={m.id}>
            Karta: {m.rights.creator} · {m.rights.license}
          </li>
        ))}
      </ul>
    </section>
  );
}
