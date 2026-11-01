import { z } from "zod";
import {
  chapterSchema,
  mediaSchema,
  sourceSchema,
  themeSchema,
  tripSchema,
  type Chapter,
  type Media,
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
}

export interface ValidContent {
  trip: Trip;
  themes: Theme[];
  chapters: Chapter[];
  sources: Source[];
  media: Media[];
}

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
export function validateContent(raw: RawContent): { errors: string[]; content?: ValidContent } {
  const errors: string[] = [];

  const trip = tripSchema.safeParse(raw.trip);
  if (!trip.success) errors.push(...formatZod("trip.json", trip.error));

  const themes = z.array(themeSchema).safeParse(raw.themes);
  if (!themes.success) errors.push(...formatZod("themes.json", themes.error));

  const sources = z.array(sourceSchema).safeParse(raw.sources);
  if (!sources.success) errors.push(...formatZod("sources.json", sources.error));

  const media = z.array(mediaSchema).safeParse(raw.media);
  if (!media.success) errors.push(...formatZod("media.json", media.error));

  const chapters: Chapter[] = [];
  for (const { file, data } of raw.chapters) {
    const parsed = chapterSchema.safeParse(data);
    if (!parsed.success) errors.push(...formatZod(file, parsed.error));
    else chapters.push(parsed.data);
  }

  if (!themes.success || !sources.success || !media.success || !trip.success) return { errors };

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

  if (errors.length) return { errors };
  return {
    errors,
    content: {
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
