/**
 * Lokal granskningsvy (kontaktsida) för bilderna: skapar review/contact-sheet.html.
 * Bara för redaktionell granskning. Filen ligger utanför public/ och ingår därför varken i bygget eller offlinepaketet.
 *
 *   npm run images:review
 */
import fs from "node:fs";
import path from "node:path";
import { validateContent } from "../src/lib/content-validate";
import { publicFiles } from "../src/lib/file-access";

const root = path.join(process.cwd(), "src", "content");
const readJson = (rel: string): unknown => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
const chapters: { file: string; data: unknown }[] = [];
for (const dir of ["chapters", "planned"])
  for (const f of fs.readdirSync(path.join(root, dir)).filter((n) => n.endsWith(".json"))) {
    const d = readJson(`${dir}/${f}`);
    if (Array.isArray(d)) d.forEach((x, i) => chapters.push({ file: `${dir}/${f}[${i}]`, data: x }));
    else chapters.push({ file: `${dir}/${f}`, data: d });
  }
const { errors, content } = validateContent(
  { trip: readJson("trip.json"), themes: readJson("themes.json"), sources: readJson("sources.json"), media: readJson("media.json"), home: readJson("home.json"), images: readJson("images.json"), chapters },
  publicFiles(),
);
if (!content) {
  console.error("Innehållet är ogiltigt:\n" + errors.map((e) => " - " + e).join("\n"));
  process.exit(1);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
interface Slot { slotId: string; owner: string; role: string; imageId: string | null; brief: string }
const slots: Slot[] = [{ slotId: content.home.hero.slotId, owner: "Startsida", role: "öppningsbild", imageId: content.home.hero.imageId, brief: content.home.hero.brief }];
for (const c of content.chapters) {
  if (c.status !== "published") continue;
  slots.push({ slotId: c.hero.slotId, owner: c.title, role: "öppningsbild", imageId: c.hero.imageId, brief: c.hero.brief });
  for (const s of c.sections) for (const b of s.blocks) if (b.type === "photo") slots.push({ slotId: b.slotId, owner: c.title, role: "förklarande bild", imageId: b.imageId, brief: b.brief });
}

const cards = slots
  .map((s) => {
    const p = content.photos.find((x) => x.id === s.imageId);
    if (!p)
      return `<article class="pending"><h3>${esc(s.slotId)}</h3><p class="meta">${esc(s.owner)} · ${s.role}</p><div class="ph">Ingen bild vald</div><p><b>Motiv att hitta:</b> ${esc(s.brief)}</p></article>`;
    const v = [...p.variants].filter((x) => x.crop === "default").sort((a, b) => b.width - a.width)[0];
    const m = p.variants.find((x) => x.crop === "mobile");
    return `<article><h3>${esc(s.slotId)}</h3><p class="meta">${esc(s.owner)} · ${s.role} · ${esc(p.kind)}</p>
<img src="../public${v.path}" width="${v.width}" height="${v.height}" alt="${esc(p.alt)}" style="object-position:${p.focus.x * 100}% ${p.focus.y * 100}%">
${m ? `<p class="meta">Mobilbeskärning:</p><img class="m" src="../public${m.path}" alt="">` : ""}
<p><b>Bildtext:</b> ${esc(p.caption)}</p><p><b>Alt-text:</b> ${esc(p.alt || "(tom, dekorativ)")}</p>
<p><b>Fotograf:</b> ${esc(p.creator)} · <a href="${esc(p.license.url)}">${esc(p.license.name)}</a> · <a href="${esc(p.sourceUrl)}">original</a></p>
<p><b>Rättigheter kontrollerade:</b> ${esc(p.rightsCheckedOn)} av ${esc(p.rightsCheckedBy)} · krediteringskrav: ${esc(p.requiredCredit ?? "inget")}</p>
<p><b>Bearbetning:</b> ${esc(p.modification)}</p>${p.peopleNote ? `<p><b>Personer:</b> ${esc(p.peopleNote)}</p>` : ""}
<p class="meta">${p.variants.map((x) => `${x.path} (${(x.bytes / 1024).toFixed(0)} kB)`).join("<br>")}</p></article>`;
  })
  .join("\n");

const html = `<!doctype html><html lang="sv"><meta charset="utf-8"><title>Bildgranskning</title>
<style>body{font:15px/1.5 system-ui;margin:2rem;background:#fbf6ec;color:#1f1d1a}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(22rem,1fr));gap:1rem}
article{background:#fff;border:1px solid #d6cbb4;border-radius:10px;padding:1rem}article.pending{background:#f3ebd9;border-style:dashed}img{width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:6px}img.m{width:8rem;aspect-ratio:4/5}.ph{aspect-ratio:3/2;background:#e7eaf6;border-radius:6px;display:grid;place-items:center}.meta{color:#4a463f;font-size:13px}h3{margin:.2rem 0}</style>
<h1>Bildgranskning (lokal, ingår inte i appen)</h1><p>${content.photos.length} bilder valda, ${slots.length - slots.filter((s) => s.imageId).length} bildplatser återstår.</p><main>${cards}</main></html>`;
fs.mkdirSync("review", { recursive: true });
fs.writeFileSync("review/contact-sheet.html", html);
console.log(`Skrev review/contact-sheet.html (${slots.length} bildplatser, ${content.photos.length} bilder).`);
