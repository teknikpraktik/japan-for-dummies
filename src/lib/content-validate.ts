import { z } from "zod";
import {
  chapterSchema,
  homeSchema,
  mediaSchema,
  photoSchema,
  sourceSchema,
  themeSchema,
  tripSchema,
  type Chapter,
  type Home,
  type Media,
  type Photo,
  type Source,
  type Theme,
  type Trip,
} from "./schema";

export interface RawContent {
  trip: unknown;
  themes: unknown;
  chapters: { file: string; data: unknown }[];
  sources: unknown;
  media: unknown;
  home: unknown;
  /** Bildregistret (fotografier). */
  images: unknown;
}

/** Filsystemsåtkomst för bildkontroller. Utelämnas i tester som bara kontrollerar struktur. */
export interface FileAccess {
  size(publicPath: string): number | undefined;
}

export interface ValidContent {
  trip: Trip;
  themes: Theme[];
  chapters: Chapter[];
  sources: Source[];
  media: Media[];
  home: Home;
  photos: Photo[];
  warnings: string[];
}

/** Gränser för bildfilers storlek (byte). Över varning = ska motiveras, över fel = avvisas. */
export const IMAGE_WARN_BYTES = 250 * 1024;
export const IMAGE_MAX_BYTES = 400 * 1024;

export const EXPECTED_THEMES = 12;
export const CHAPTERS_PER_THEME = 5;

function formatZod(prefix: string, err: z.ZodError): string[] {
  return err.issues.map((i) => `${prefix}: ${i.path.join(".") || "(rot)"} – ${i.message}`);
}

function dupes(values: string[]): string[] {
  const seen = new Set<string>();
  const out = new Set<string>();
  for (const v of values) (seen.has(v) ? out : seen).add(v);
  return [...out];
}

/** Validerar hela innehållsuppsättningen. Returnerar alla fel (tom lista = giltigt). */
export function validateContent(raw: RawContent, files?: FileAccess): { errors: string[]; content?: ValidContent } {
  const errors: string[] = [];

  const trip = tripSchema.safeParse(raw.trip);
  if (!trip.success) errors.push(...formatZod("trip.json", trip.error));

  const themes = z.array(themeSchema).safeParse(raw.themes);
  if (!themes.success) errors.push(...formatZod("themes.json", themes.error));

  const sources = z.array(sourceSchema).safeParse(raw.sources);
  if (!sources.success) errors.push(...formatZod("sources.json", sources.error));

  const media = z.array(mediaSchema).safeParse(raw.media);
  if (!media.success) errors.push(...formatZod("media.json", media.error));

  const home = homeSchema.safeParse(raw.home);
  if (!home.success) errors.push(...formatZod("home.json", home.error));

  const photos = z.array(photoSchema).safeParse(raw.images);
  if (!photos.success) errors.push(...formatZod("images.json", photos.error));

  const chapters: Chapter[] = [];
  for (const { file, data } of raw.chapters) {
    const parsed = chapterSchema.safeParse(data);
    if (!parsed.success) errors.push(...formatZod(file, parsed.error));
    else chapters.push(parsed.data);
  }

  if (!themes.success || !sources.success || !media.success || !trip.success || !home.success || !photos.success) return { errors };
  const warnings: string[] = [];

  for (const d of dupes(themes.data.map((t) => t.id))) errors.push(`Dubbelt tema-ID: ${d}`);
  for (const d of dupes(sources.data.map((s) => s.id))) errors.push(`Dubbelt käll-ID: ${d}`);
  for (const d of dupes(media.data.map((m) => m.id))) errors.push(`Dubbelt media-ID: ${d}`);
  for (const d of dupes(chapters.map((c) => c.id))) errors.push(`Dubbelt kapitel-ID: ${d}`);
  for (const d of dupes(chapters.map((c) => c.slug))) errors.push(`Dubbelt adressnamn (slug): ${d}`);

  const themeIds = new Set(themes.data.map((t) => t.id));
  const sourceIds = new Set(sources.data.map((s) => s.id));
  const mediaIds = new Set(media.data.map((m) => m.id));

  if (themes.data.length !== EXPECTED_THEMES) errors.push(`Förväntade ${EXPECTED_THEMES} teman, hittade ${themes.data.length}`);
  if (chapters.length !== EXPECTED_THEMES * CHAPTERS_PER_THEME && errors.length === 0) {
    errors.push(`Förväntade ${EXPECTED_THEMES * CHAPTERS_PER_THEME} kapitel, hittade ${chapters.length}`);
  }

  for (const t of themes.data) {
    const inTheme = chapters.filter((c) => c.themeId === t.id);
    if (inTheme.length !== CHAPTERS_PER_THEME) errors.push(`Tema ${t.id} har ${inTheme.length} kapitel, förväntade ${CHAPTERS_PER_THEME}`);
    for (const d of dupes(inTheme.map((c) => String(c.order)))) errors.push(`Tema ${t.id}: dubbel ordning ${d}`);
  }

  for (const c of chapters) {
    if (!themeIds.has(c.themeId)) errors.push(`Kapitel ${c.id}: okänt tema ${c.themeId}`);
    if (c.status !== "published") continue;
    for (const s of c.sourceIds) if (!sourceIds.has(s)) errors.push(`Kapitel ${c.id}: okänd källa ${s}`);
    for (const m of c.mediaIds) if (!mediaIds.has(m)) errors.push(`Kapitel ${c.id}: okänd media ${m}`);
    for (const sec of c.sections)
      for (const b of sec.blocks)
        if (b.type === "figure" && !c.mediaIds.includes(b.mediaId))
          errors.push(`Kapitel ${c.id}: bilden ${b.mediaId} används men saknas i mediaIds`);
    for (const d of dupes(c.sections.map((s) => s.id))) errors.push(`Kapitel ${c.id}: dubbelt avsnitts-ID ${d}`);
    for (const d of dupes(c.exercises.map((e) => e.id))) errors.push(`Kapitel ${c.id}: dubbelt övnings-ID ${d}`);
    for (const d of dupes(c.quiz.map((q) => q.id))) errors.push(`Kapitel ${c.id}: dubbelt frågeID ${d}`);
    for (const d of dupes(c.sourceIds)) errors.push(`Kapitel ${c.id}: källa listad flera gånger: ${d}`);
  }

  /* ---------- Bilder ---------- */
  const photoIds = new Set(photos.data.map((p) => p.id));
  for (const d of dupes(photos.data.map((p) => p.id))) errors.push(`Dubbelt bild-ID: ${d}`);
  const allPaths = photos.data.flatMap((p) => p.variants.map((v) => v.path));
  for (const d of dupes(allPaths)) errors.push(`Samma bildfil används av flera varianter: ${d}`);

  // Bildplatser och användning
  const slots: { slotId: string; imageId: string | null; owner: string }[] = [{ slotId: home.data.hero.slotId, imageId: home.data.hero.imageId, owner: "home" }];
  for (const c of chapters) {
    if (c.status !== "published") continue;
    slots.push({ slotId: c.hero.slotId, imageId: c.hero.imageId, owner: c.id });
    for (const sec of c.sections) for (const b of sec.blocks) if (b.type === "photo") slots.push({ slotId: b.slotId, imageId: b.imageId, owner: c.id });
  }
  for (const d of dupes(slots.map((s) => s.slotId))) errors.push(`Dubbelt bildplats-ID: ${d}`);
  const slotIds = new Set(slots.map((s) => s.slotId));
  const owners = new Set([...chapters.map((c) => c.id), "home"]);
  for (const c of chapters) {
    if (c.status !== "published") continue;
    for (const sec of c.sections)
      for (const b of sec.blocks)
        if (b.type === "observe") for (const sid of b.imageSlotIds) if (!slotIds.has(sid)) errors.push(`Kapitel ${c.id}: observationsuppgiften hänvisar till okänd bildplats ${sid}`);
  }
  for (const s of slots) {
    if (s.imageId && !photoIds.has(s.imageId)) errors.push(`Bildplats ${s.slotId}: okänd bild ${s.imageId}`);
    if (s.imageId) {
      const p = photos.data.find((x) => x.id === s.imageId);
      if (p && !p.usedIn.includes(s.owner)) errors.push(`Bild ${p.id} används i ${s.owner} men saknar det i usedIn`);
    }
  }
  for (const p of photos.data) {
    for (const u of p.usedIn) {
      if (!owners.has(u)) errors.push(`Bild ${p.id}: usedIn hänvisar till okänd plats ${u}`);
      else if (!slots.some((s) => s.owner === u && s.imageId === p.id)) errors.push(`Bild ${p.id}: står som använd i ${u} men används inte där`);
    }
    for (const v of p.variants) {
      if (files) {
        const size = files.size(v.path);
        if (size === undefined) errors.push(`Bild ${p.id}: filen saknas lokalt: ${v.path}`);
        else {
          if (size !== v.bytes) errors.push(`Bild ${p.id}: filstorleken (${size} B) stämmer inte med registret (${v.bytes} B): ${v.path}`);
          if (size > IMAGE_MAX_BYTES) errors.push(`Bild ${p.id}: ${v.path} är för stor (${Math.round(size / 1024)} kB, max ${IMAGE_MAX_BYTES / 1024} kB)`);
          else if (size > IMAGE_WARN_BYTES) warnings.push(`Bild ${p.id}: ${v.path} är ${Math.round(size / 1024)} kB (rekommenderat under ${IMAGE_WARN_BYTES / 1024} kB)`);
        }
      }
    }
  }

  if (errors.length) return { errors };
  return {
    errors,
    content: {
      home: home.data,
      photos: photos.data,
      warnings,
      trip: trip.data,
      themes: [...themes.data].sort((a, b) => a.order - b.order),
      chapters: [...chapters].sort((a, b) => {
        const ta = themes.data.find((t) => t.id === a.themeId)!.order;
        const tb = themes.data.find((t) => t.id === b.themeId)!.order;
        return ta - tb || a.order - b.order;
      }),
      sources: sources.data,
      media: media.data,
    },
  };
}
