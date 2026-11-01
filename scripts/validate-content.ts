import fs from "node:fs";
import path from "node:path";
import { validateContent } from "../src/lib/content-validate";
import { publicFiles } from "../src/lib/file-access";

// Samma inläsning som src/lib/content.ts men utan "server-only".
const root = path.join(process.cwd(), "src", "content");
const readJson = (rel: string): unknown => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));

const chapters: { file: string; data: unknown }[] = [];
for (const dir of ["chapters", "planned"]) {
  for (const f of fs.readdirSync(path.join(root, dir)).filter((n) => n.endsWith(".json")).sort()) {
    const data = readJson(`${dir}/${f}`);
    if (Array.isArray(data)) data.forEach((d, i) => chapters.push({ file: `${dir}/${f}[${i}]`, data: d }));
    else chapters.push({ file: `${dir}/${f}`, data });
  }
}

const { errors, content } = validateContent({
  trip: readJson("trip.json"),
  themes: readJson("themes.json"),
  sources: readJson("sources.json"),
  media: readJson("media.json"),
  home: readJson("home.json"),
  images: readJson("images.json"),
  chapters,
}, publicFiles());

if (!content) {
  console.error(`Innehållsvalidering misslyckades (${errors.length} fel):`);
  for (const e of errors) console.error(" - " + e);
  process.exit(1);
}
for (const w of content.warnings) console.warn("Varning: " + w);
const published = content.chapters.filter((c) => c.status === "published").length;
console.log(`Innehåll OK: ${content.themes.length} teman, ${content.chapters.length} kapitel (${published} publicerade, ${content.chapters.length - published} planerade), ${content.sources.length} källor.`);
const filled: (string | null)[] = [content.home.hero.imageId];
for (const c of content.chapters) {
  if (c.status !== "published") continue;
  filled.push(c.hero.imageId);
  for (const sec of c.sections) for (const b of sec.blocks) if (b.type === "photo") filled.push(b.imageId);
}
console.log(`Bilder: ${content.photos.length} fotografier i registret, ${filled.filter(Boolean).length} av ${filled.length} bildplatser fyllda (${filled.filter((x) => !x).length} saknar bild).`);
