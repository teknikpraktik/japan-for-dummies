import { z } from "zod";

/** Gemensamma byggstenar */
const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "ID får bara innehålla a–z, 0–9 och bindestreck");
const text = z.string().trim().min(1, "Text får inte vara tom");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum ska vara ÅÅÅÅ-MM-DD");

/* ---------- Innehållsblock (ingen godtycklig HTML) ---------- */
export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("p"), text }),
  z.object({ type: z.literal("list"), ordered: z.boolean().default(false), items: z.array(text).min(1) }),
  z.object({
    type: z.literal("callout"),
    tone: z.enum(["info", "care", "check"]),
    title: text,
    text,
  }),
  z.object({
    type: z.literal("phrases"),
    items: z
      .array(z.object({ jp: text, romaji: text, sv: text, tip: z.string().optional() }))
      .min(1),
  }),
  z.object({ type: z.literal("figure"), mediaId: id }),
  /** Fotografi ur bildregistret. imageId = null betyder att bilden ännu inte är vald (visar reservyta med motivbeskrivning). */
  z.object({ type: z.literal("photo"), slotId: id, imageId: id.nullable(), brief: text }),
  /** Enkel observationsuppgift. Poängsätts inte och sparas inte. Ska fungera även utan bild (textalternativet). */
  z.object({
    type: z.literal("observe"),
    title: text,
    prompt: text,
    steps: z.array(text).min(2).max(5),
    /** Likvärdig uppgift för den som inte ser bilden, eller när bild saknas. */
    textAlternative: text,
    imageSlotIds: z.array(id).default([]),
  }),
  z.object({
    type: z.literal("facts"),
    items: z.array(z.object({ label: text, value: text })).min(1),
  }),
  z.object({
    type: z.literal("timeline"),
    items: z.array(z.object({ when: text, text })).min(2),
  }),
]);
export type Block = z.infer<typeof blockSchema>;

export const sectionSchema = z.object({
  id,
  heading: text,
  blocks: z.array(blockSchema).min(1),
});
export type Section = z.infer<typeof sectionSchema>;

/* ---------- Övningar ---------- */
const option = z.object({
  id,
  text,
  correct: z.boolean().default(false),
  feedback: text,
});
const optionsSchema = z
  .array(option)
  .min(2)
  .superRefine((opts, ctx) => {
    const ids = new Set<string>();
    for (const o of opts) {
      if (ids.has(o.id)) ctx.addIssue({ code: "custom", message: `Dubbelt alternativ-ID: ${o.id}` });
      ids.add(o.id);
    }
    const correct = opts.filter((o) => o.correct).length;
    if (correct !== 1) ctx.addIssue({ code: "custom", message: `Exakt ett alternativ ska vara rätt (hittade ${correct})` });
  });

export const multipleChoiceSchema = z.object({
  type: z.literal("multiple-choice"),
  id,
  title: text,
  prompt: text,
  options: optionsSchema,
});

export const orderingSchema = z.object({
  type: z.literal("ordering"),
  id,
  title: text,
  prompt: text,
  /** Stegen i RÄTT ordning – komponenten blandar dem. */
  items: z.array(z.object({ id, text, note: z.string().optional() })).min(3).max(8),
  explanation: text,
});

export const scenarioSchema = z.object({
  type: z.literal("scenario"),
  id,
  title: text,
  situation: text,
  question: text,
  options: optionsSchema,
});

export const exerciseSchema = z.discriminatedUnion("type", [multipleChoiceSchema, orderingSchema, scenarioSchema]);
export type Exercise = z.infer<typeof exerciseSchema>;
export type MultipleChoiceExercise = z.infer<typeof multipleChoiceSchema>;
export type OrderingExercise = z.infer<typeof orderingSchema>;
export type ScenarioExercise = z.infer<typeof scenarioSchema>;

export const quizQuestionSchema = z.object({
  id,
  prompt: text,
  options: optionsSchema,
});
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

/* ---------- Kapitel ---------- */
const objectives = z.array(text).min(2).max(3);

const chapterBase = {
  id,
  slug: id,
  themeId: id,
  order: z.number().int().min(1).max(5),
  title: text,
  summary: text,
  objectives,
  contentVersion: z.number().int().min(0),
};

export const plannedChapterSchema = z.object({
  ...chapterBase,
  status: z.literal("planned"),
  contentVersion: z.literal(0),
});

export const reviewSchema = z.object({
  /** Datum då kontrollen faktiskt gjordes. */
  reviewedOn: isoDate,
  /** Hur kontrollen gjordes – ska vara ärlig om metoden. */
  method: text,
  status: z.enum(["needs-human-review", "human-reviewed"]),
  uncertainty: z.array(text).min(1),
  /** Uppgifter som ändras och måste kontrolleras nära avresa. */
  checkBeforeTravel: z.array(text).default([]),
});

export const publishedChapterSchema = z.object({
  ...chapterBase,
  status: z.literal("published"),
  contentVersion: z.number().int().min(1),
  minutes: z.number().int().min(3).max(12),
  hook: z.object({ kind: z.enum(["question", "situation"]), text }),
  sections: z.array(sectionSchema).min(2),
  exercises: z.array(exerciseSchema).min(1),
  noticeOnTrip: z.array(text).min(2),
  reflection: text,
  quiz: z.array(quizQuestionSchema).length(5, "Ett kapiteltest ska ha exakt fem frågor"),
  sourceIds: z.array(id),
  review: reviewSchema,
  mediaIds: z.array(id).default([]),
  /** Öppningsbild. imageId = null tills ett rättighetskontrollerat fotografi är valt. */
  hero: z.object({ slotId: id, imageId: id.nullable(), brief: text }),
});
export type PublishedChapter = z.infer<typeof publishedChapterSchema>;
export type PlannedChapter = z.infer<typeof plannedChapterSchema>;

export const chapterSchema = z.discriminatedUnion("status", [publishedChapterSchema, plannedChapterSchema]);
export type Chapter = PublishedChapter | PlannedChapter;

/* ---------- Teman, resa, källor, media ---------- */
export const themeSchema = z.object({
  id,
  order: z.number().int().min(1),
  title: text,
  description: text,
});
export type Theme = z.infer<typeof themeSchema>;

export const tripSchema = z.object({
  name: text,
  /** ÅÅÅÅ-MM. Inget exakt avresedatum är fastställt. */
  departureMonth: z.string().regex(/^\d{4}-\d{2}$/),
  audience: z.object({
    students: z.number().int().positive(),
    teachers: z.number().int().positive(),
    level: text,
  }),
  /** Tom tills resmål är beslutade. */
  destinations: z.array(text),
  destinationsNote: text,
});
export type Trip = z.infer<typeof tripSchema>;

export const sourceSchema = z.object({
  id,
  title: text,
  publisher: text,
  url: z.url(),
  kind: z.enum(["official", "institution", "news-or-reference", "travel-guide"]),
  /** Datum då vi faktiskt tog del av källan (inte nödvändigtvis publiceringsdatum). */
  checkedOn: isoDate,
  /** Hur källan kontrollerades. */
  access: z.enum(["opened", "search-result-summary", "not-checked"]),
  supports: text,
});
export type Source = z.infer<typeof sourceSchema>;

export const mediaSchema = z.object({
  id,
  src: z.string().startsWith("/media/"),
  alt: text,
  caption: text,
  rights: z.object({
    creator: text,
    license: text,
    note: text,
  }),
});
export type Media = z.infer<typeof mediaSchema>;

/* ---------- Fotografier (bildregister) ---------- */
export const imageVariantSchema = z.object({
  /** Lokal sökväg under /images/. Inga externa bildlänkar vid visning. */
  path: z.string().regex(/^\/images\/[a-z0-9][a-z0-9/_.-]*\.(webp|avif)$/, "Sökvägen ska ligga under /images/ och sluta på .webp eller .avif"),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().positive(),
  format: z.enum(["webp", "avif"]),
  /** "default" gäller alla skärmar; "mobile" är en särskild beskärning för smala skärmar. */
  crop: z.enum(["default", "mobile"]).default("default"),
});
export type ImageVariant = z.infer<typeof imageVariantSchema>;

const verifiedFact = z.object({ value: text, verifiedBy: text });

export const photoSchema = z
  .object({
    id,
    /** Skiljer historiskt original, rekonstruktion och nutida fotografi. */
    kind: z.enum(["contemporary-photo", "historical-original", "reconstruction", "object-photo"]),
    variants: z.array(imageVariantSchema).min(1),
    /** Fokuspunkt (0–1) som bevaras vid responsiv beskärning. */
    focus: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).default({ x: 0.5, y: 0.5 }),
    creator: text,
    sourcePlatform: z.enum(["unsplash", "pexels", "wikimedia-commons", "official-japan", "other"]),
    /** Originalets informationssida. */
    sourceUrl: z.url(),
    license: z.object({ name: text, url: z.url() }),
    /** Datum då rättigheterna faktiskt kontrollerades på originalets sida. */
    rightsCheckedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    rightsCheckedBy: text,
    /** Obligatorisk kreditering enligt licensen, annars null (fotografen erkänns ändå vid bilden). */
    requiredCredit: z.string().nullable(),
    /** Uttryckligen kontrollerat: webbpublicering, lokal lagring/offline, bearbetning och lagring i publikt repo. */
    usageCleared: z.object({
      webPublishing: z.literal(true),
      offlinePackage: z.literal(true),
      modification: z.literal(true),
      publicRepoStorage: z.literal(true),
    }),
    location: verifiedFact.optional(),
    year: verifiedFact.optional(),
    caption: text,
    alt: z.string(),
    /** Dekorativa bilder har tom alternativtext. */
    decorative: z.boolean().default(false),
    modification: text,
    peopleNote: z.string().optional(),
    usedIn: z.array(id).min(1),
  })
  .superRefine((p, ctx) => {
    if (p.decorative && p.alt !== "") ctx.addIssue({ code: "custom", path: ["alt"], message: "Dekorativ bild ska ha tom alternativtext" });
    if (!p.decorative && p.alt.trim().length < 15) ctx.addIssue({ code: "custom", path: ["alt"], message: "Alternativtext saknas eller är för kort (minst 15 tecken)" });
    if (!p.variants.some((v) => v.crop === "default")) ctx.addIssue({ code: "custom", path: ["variants"], message: "Minst en variant med crop=default krävs" });
    const checked = Date.parse(p.rightsCheckedOn);
    if (Number.isNaN(checked) || checked > Date.now() + 86_400_000) ctx.addIssue({ code: "custom", path: ["rightsCheckedOn"], message: "Kontrolldatum ogiltigt eller i framtiden" });
  });
export type Photo = z.infer<typeof photoSchema>;

export const homeSchema = z.object({
  /** Startsidans öppningsbild. */
  hero: z.object({ slotId: id, imageId: id.nullable(), brief: text }),
});
export type Home = z.infer<typeof homeSchema>;
