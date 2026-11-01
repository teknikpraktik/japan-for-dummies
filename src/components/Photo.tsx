import Link from "next/link";
import type { Photo, ImageVariant } from "@/lib/schema";
import { getContent } from "@/lib/content";

const kindLabel: Record<Photo["kind"], string> = {
  "contemporary-photo": "Nutida fotografi",
  "historical-original": "Historiskt original",
  reconstruction: "Rekonstruktion",
  "object-photo": "Föremål (fotografi)",
};

export type PhotoRole = "hero" | "figure" | "card";

const frame: Record<PhotoRole, string> = {
  hero: "aspect-[4/3] sm:aspect-[16/9]",
  figure: "aspect-[4/3] sm:aspect-[3/2]",
  card: "aspect-[3/2]",
};
/** Hur bredden används, så att webbläsaren väljer lagom stor fil. */
const sizes: Record<PhotoRole, string> = {
  hero: "(min-width: 1024px) 992px, 100vw",
  figure: "(min-width: 768px) 672px, 100vw",
  card: "(min-width: 768px) 320px, 100vw",
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
      {byCrop("mobile", "avif").length > 0 && <source media="(max-width: 639px)" type="image/avif" srcSet={srcSet(byCrop("mobile", "avif"))} sizes="100vw" />}
      {byCrop("mobile", "webp").length > 0 && <source media="(max-width: 639px)" type="image/webp" srcSet={srcSet(byCrop("mobile", "webp"))} sizes="100vw" />}
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

/** Reservyta när fotografiet ännu inte är valt och rättighetskontrollerat. Ärlig om att bild saknas. */
export function PhotoPlaceholder({ role, slotId, brief }: { role: PhotoRole; slotId: string; brief: string }) {
  return (
    <div
      aria-hidden="true"
      data-testid="photo-placeholder"
      data-slot={slotId}
      className={`${frame[role]} flex w-full items-center justify-center rounded-xl border border-dashed border-line bg-indigo-soft`}
    >
      <svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo/60">
        <rect x="5" y="12" width="38" height="26" rx="4" />
        <circle cx="24" cy="25" r="7" />
        <path d="M17 12l2-4h10l2 4" />
      </svg>
      <span className="sr-only">{brief}</span>
    </div>
  );
}

/** En bildplats: visar fotografiet om det är valt, annars reservytan med planerat motiv. */
export function PhotoSlot({
  role,
  slotId,
  imageId,
  brief,
  priority,
}: {
  role: PhotoRole;
  slotId: string;
  imageId: string | null;
  brief: string;
  priority?: boolean;
}) {
  const photo = findPhoto(imageId);
  if (!photo) {
    return (
      <figure className="space-y-2" data-slot-state="pending">
        <PhotoPlaceholder role={role} slotId={slotId} brief={brief} />
        <figcaption className="text-sm text-ink-soft">
          <strong>Fotografi väljs.</strong> Planerat motiv: {brief}
        </figcaption>
      </figure>
    );
  }
  return (
    <figure className="space-y-2" data-slot-state="filled" id={`bild-${slotId}`}>
      <div className={`${frame[role]} overflow-hidden rounded-xl bg-paper-2`}>
        <PhotoPicture photo={photo} role={role} priority={priority} />
      </div>
      <figcaption className="space-y-1">
        <span className="block text-sm">{photo.caption}</span>
        <PhotoCredit photo={photo} />
      </figcaption>
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
