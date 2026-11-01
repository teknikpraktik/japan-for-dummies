import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { validateContent, type RawContent } from "@/lib/content-validate";
import { publicFiles } from "@/lib/file-access";

const root = path.join(process.cwd(), "src", "content");
const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));

function loadRaw(): RawContent {
  const chapters: RawContent["chapters"] = [];
  for (const dir of ["chapters", "planned"]) {
    for (const f of fs.readdirSync(path.join(root, dir)).filter((n) => n.endsWith(".json"))) {
      const data = read(`${dir}/${f}`);
      if (Array.isArray(data)) data.forEach((d, i) => chapters.push({ file: `${f}[${i}]`, data: d }));
      else chapters.push({ file: f, data });
    }
  }
  return { trip: read("trip.json"), themes: read("themes.json"), sources: read("sources.json"), media: read("media.json"), home: read("home.json"), images: read("images.json"), chapters };
}
const clone = <T,>(x: T): T => structuredClone(x);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pilot = (raw: RawContent) => raw.chapters.find((c) => (c.data as any).status === "published")!.data as any;

describe("innehållsvalidering", () => {
  it("det riktiga innehållet är giltigt: 12 teman, 60 kapitel, 6 publicerade", () => {
    const { errors, content } = validateContent(loadRaw(), publicFiles());
    expect(errors).toEqual([]);
    expect(content!.themes).toHaveLength(12);
    expect(content!.chapters).toHaveLength(60);
    expect(content!.chapters.filter((c) => c.status === "published")).toHaveLength(6);
    for (const t of content!.themes) expect(content!.chapters.filter((c) => c.themeId === t.id)).toHaveLength(5);
  });

  it("varje publicerat kapitel har fem testfrågor, minst en övning och ett rätt svar per fråga", () => {
    const { content } = validateContent(loadRaw());
    for (const c of content!.chapters) {
      if (c.status !== "published") continue;
      expect(c.quiz).toHaveLength(5);
      expect(c.exercises.length).toBeGreaterThanOrEqual(1);
      expect(c.noticeOnTrip.length).toBeGreaterThan(0);
      expect(c.reflection.length).toBeGreaterThan(10);
      for (const q of c.quiz) {
        expect(q.options.filter((o) => o.correct)).toHaveLength(1);
        for (const o of q.options) expect(o.feedback.length).toBeGreaterThan(0);
      }
    }
  });

  it("de 54 planerade kapitlen har unika titlar och beskrivningar (ingen upprepad utfyllnad)", () => {
    const { content } = validateContent(loadRaw());
    const planned = content!.chapters.filter((c) => c.status === "planned");
    expect(planned).toHaveLength(54);
    expect(new Set(planned.map((c) => c.title)).size).toBe(54);
    expect(new Set(planned.map((c) => c.summary)).size).toBe(54);
  });

  it("fångar dubbla kapitel-ID", () => {
    const raw = loadRaw();
    const dup = clone(raw.chapters[0]);
    raw.chapters.push({ file: "dup", data: dup.data });
    const { errors } = validateContent(raw);
    expect(errors.some((e) => e.includes("Dubbelt kapitel-ID"))).toBe(true);
  });

  it("fångar dubbla adressnamn", () => {
    const raw = loadRaw();
    const a = clone(raw.chapters[1].data) as { slug: string };
    a.slug = (raw.chapters[0].data as { slug: string }).slug;
    raw.chapters[1] = { file: raw.chapters[1].file, data: a };
    expect(validateContent(raw).errors.some((e) => e.includes("Dubbelt adressnamn"))).toBe(true);
  });

  it("fångar test med fel antal frågor", () => {
    const raw = loadRaw();
    pilot(raw).quiz.pop();
    expect(validateContent(raw).errors.some((e) => e.includes("exakt fem frågor"))).toBe(true);
  });

  it("fångar fråga utan rätt svar och fråga med två rätta svar", () => {
    let raw = loadRaw();
    for (const o of pilot(raw).quiz[0].options) o.correct = false;
    expect(validateContent(raw).errors.some((e) => e.includes("Exakt ett alternativ"))).toBe(true);
    raw = loadRaw();
    for (const o of pilot(raw).quiz[0].options) o.correct = true;
    expect(validateContent(raw).errors.some((e) => e.includes("Exakt ett alternativ"))).toBe(true);
  });

  it("fångar saknade obligatoriska fält", () => {
    const raw = loadRaw();
    delete pilot(raw).reflection;
    delete pilot(raw).title;
    const { errors } = validateContent(raw);
    expect(errors.some((e) => e.includes("reflection"))).toBe(true);
    expect(errors.some((e) => e.includes("title"))).toBe(true);
  });

  it("fångar okänd källa och okänd bild", () => {
    const raw = loadRaw();
    pilot(raw).sourceIds.push("finns-inte");
    pilot(raw).mediaIds.push("finns-inte-heller");
    const { errors } = validateContent(raw);
    expect(errors.some((e) => e.includes("okänd källa"))).toBe(true);
    expect(errors.some((e) => e.includes("okänd media"))).toBe(true);
  });

  it("avvisar okänd blocktyp (ingen godtycklig HTML)", () => {
    const raw = loadRaw();
    pilot(raw).sections[0].blocks.push({ type: "html", html: "<script>alert(1)</script>" });
    expect(validateContent(raw).errors.length).toBeGreaterThan(0);
  });

  it("fångar dubbla alternativ-ID", () => {
    const raw = loadRaw();
    const opts = pilot(raw).quiz[0].options;
    opts[1].id = opts[0].id;
    expect(validateContent(raw).errors.some((e) => e.includes("Dubbelt alternativ-ID"))).toBe(true);
  });

  it("fångar fel antal kapitel i ett tema", () => {
    const raw = loadRaw();
    raw.chapters.pop();
    expect(validateContent(raw).errors.length).toBeGreaterThan(0);
  });
});
