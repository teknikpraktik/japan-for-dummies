import { getContent } from "@/lib/content";
import { PhotoRights, PhotoSlot, photosFor, platformName } from "@/components/Photo";
import { START_IMAGE_RUNTIME, startCreditHtml, startDataJson, startFigureHtml, toStartItem, type StartData } from "@/lib/start-image";
import { StartHeroBoot } from "@/components/StartHero";

/** Kandidater och reservbild ur befintligt bildregister. Pool och reservbild anges i home.json. */
export function startData(): StartData {
  const { photos, home } = getContent();
  const items = home.startImages.flatMap((id) => {
    const p = photos.find((x) => x.id === id);
    return p ? [toStartItem(p, platformName[p.sourcePlatform])] : [];
  });
  const fallback = items.find((i) => i.id === home.hero.imageId)?.id ?? items[0]?.id ?? "";
  return { fallback, items };
}

/** Startsidans bildyta. Bild, bildtext och kreditering väljs tillsammans av skriptet i StartCredit. */
export function StartHero() {
  const { home } = getContent();
  const data = startData();
  // Ingen kandidat vald i innehållet: visa den ordinarie bildplatsen (bild eller reservyta), utan slumpning.
  if (data.items.length === 0) return <PhotoSlot role="card" slotId={home.hero.slotId} imageId={home.hero.imageId} brief={home.hero.brief} priority />;
  const fb = data.items.find((i) => i.id === data.fallback)!;
  return (
    <>
      <figure
        id="start-hero"
        className="space-y-2"
        data-slot-state="filled"
        data-start-image={fb.id}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: startFigureHtml(fb) }}
      />
      <script id="start-image-data" type="application/json" dangerouslySetInnerHTML={{ __html: startDataJson(data) }} />
    </>
  );
}

/**
 * ”Bilder och rättigheter” för startsidan: visar den bild som faktiskt visas. Servern renderar reservbildens rad;
 * skriptet byter raden till den valda bildens. Skriptet står sist på sidan, efter bildytan, dataelementet och denna rad.
 */
export function StartCredit() {
  const { home } = getContent();
  const data = startData();
  if (data.items.length === 0) return <PhotoRights photos={photosFor([home.hero.imageId])} />;
  const fb = data.items.find((i) => i.id === data.fallback)!;
  return (
    <>
      <section aria-labelledby="bilder-rattigheter" className="prose-col space-y-2" data-testid="photo-rights">
        <h2 id="bilder-rattigheter" className="!text-sm !font-semibold text-ink-soft">
          Bilder och rättigheter
        </h2>
        <ul className="space-y-1.5 text-sm text-ink-soft">
          <li id="start-credit" data-testid={`rights-${fb.id}`} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: startCreditHtml(fb) }} />
        </ul>
      </section>
      <script dangerouslySetInnerHTML={{ __html: START_IMAGE_RUNTIME }} />
      <StartHeroBoot />
    </>
  );
}
