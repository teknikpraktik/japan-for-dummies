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
