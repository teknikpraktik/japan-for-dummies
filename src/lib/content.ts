import "server-only";
import fs from "node:fs";
import path from "node:path";
import { validateContent, type ValidContent } from "./content-validate";

const root = path.join(process.cwd(), "src", "content");

function readJson(rel: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

export function readRawContent() {
  const chapters: { file: string; data: unknown }[] = [];
  for (const dir of ["chapters", "planned"]) {
    for (const f of fs.readdirSync(path.join(root, dir)).filter((n) => n.endsWith(".json")).sort()) {
      const data = readJson(`${dir}/${f}`);
      if (Array.isArray(data)) data.forEach((d, i) => chapters.push({ file: `${dir}/${f}[${i}]`, data: d }));
      else chapters.push({ file: `${dir}/${f}`, data });
    }
  }
  return {
    trip: readJson("trip.json"),
    themes: readJson("themes.json"),
    sources: readJson("sources.json"),
    media: readJson("media.json"),
    chapters,
  };
}

let cached: ValidContent | undefined;

/** Läser och validerar allt innehåll. Kastar vid fel så att bygget misslyckas. */
export function getContent(): ValidContent {
  if (cached) return cached;
  const { errors, content } = validateContent(readRawContent());
  if (!content) throw new Error("Ogiltigt innehåll:\n" + errors.map((e) => " - " + e).join("\n"));
  cached = content;
  return content;
}
