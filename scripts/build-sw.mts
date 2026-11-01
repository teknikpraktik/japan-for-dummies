/**
 * Efterbygge för serverdrift: skapar public/offline-manifest.json och public/sw.js ur Next.js-bygget.
 * Körs efter `next build` (se package.json). Filerna serveras av Next.js/Vercel från public/.
 *
 * Offlinelistan innehåller bara OFFENTLIGT innehåll: förrenderade utbildningssidor, statiska resurser
 * (.next/static), och public/ (bilder, ikoner). Skyddade och personliga sidor ingår aldrig (kontrolleras).
 */
import { build } from "esbuild";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isPrivatePath } from "../src/lib/private-paths";

const root = process.cwd();
const nextDir = path.join(root, ".next");
if (!fs.existsSync(path.join(nextDir, "server", "app"))) throw new Error(".next saknas. Kör next build först.");

interface Entry { url: string; size: number; hash: string }
const entries: Entry[] = [];
const add = (url: string, file: string) => {
  const buf = fs.readFileSync(file);
  entries.push({ url, size: buf.length, hash: createHash("sha1").update(buf).digest("hex").slice(0, 12) });
};

function walk(dir: string, fn: (file: string, rel: string) => void, base = dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, fn, base);
    else fn(full, path.relative(base, full).split(path.sep).join("/"));
  }
}

// 1. Förrenderade sidor (statisk HTML). Dynamiska/personliga sidor har ingen HTML-fil och kommer därför aldrig med.
const appDir = path.join(nextDir, "server", "app");
walk(appDir, (file, rel) => {
  if (!rel.endsWith(".html")) return;
  if (rel.startsWith("api/") || rel.includes("[") || rel.startsWith("_")) return;
  const route = rel === "index.html" ? "/" : `/${rel.slice(0, -".html".length)}/`;
  // Skyddade sidor har bara ett tomt skal, men ingår ändå aldrig i den delade offlinecachen.
  if (isPrivatePath(route)) return;
  add(route, file);
});
const manifestBody = path.join(appDir, "manifest.webmanifest.body");
if (fs.existsSync(manifestBody)) add("/manifest.webmanifest", manifestBody);

// 2. Statiska resurser från bygget (hashade filer).
walk(path.join(nextDir, "static"), (file, rel) => {
  if (rel.endsWith(".map")) return;
  add(`/_next/static/${rel}`, file);
});

// 3. public/ (bilder, ikoner, offlinesidor). Genererade filer och granskningsmaterial utesluts.
const publicDir = path.join(root, "public");
const EXCLUDE = new Set(["sw.js", "offline-manifest.json", ".DS_Store"]);
walk(publicDir, (file, rel) => {
  if (EXCLUDE.has(rel)) return;
  add(`/${rel}`, file);
});

entries.sort((a, b) => a.url.localeCompare(b.url));

// Säkerhetskontroll: inga skyddade eller personliga sökvägar i den delade cachen.
const leaked = entries.filter((e) => isPrivatePath(e.url));
if (leaked.length) throw new Error("Skyddade sökvägar i offlinelistan:\n" + leaked.map((l) => " - " + l.url).join("\n"));

const buildId = createHash("sha1").update(entries.map((e) => e.url + e.hash).join("\n")).digest("hex").slice(0, 10);
const imageFiles = entries.filter((e) => e.url.startsWith("/images/"));
const manifest = {
  buildId,
  generatedAt: new Date().toISOString(),
  totalBytes: entries.reduce((n, e) => n + e.size, 0),
  imageFiles: imageFiles.length,
  imageBytes: imageFiles.reduce((n, e) => n + e.size, 0),
  files: entries.map((e) => ({ url: e.url, size: e.size })),
};

// Offlinepaketet får inte sakna bildfiler som bildregistret hänvisar till.
const registry = JSON.parse(fs.readFileSync(path.join(root, "src/content/images.json"), "utf8")) as { variants: { path: string }[] }[];
const have = new Set(entries.map((e) => e.url));
const missing = registry.flatMap((p) => p.variants.map((v) => v.path)).filter((p) => !have.has(p));
if (missing.length) throw new Error("Bildfiler saknas i bygget/offlinelistan:\n" + missing.map((m) => " - " + m).join("\n"));

fs.writeFileSync(path.join(publicDir, "offline-manifest.json"), JSON.stringify(manifest));

await build({
  entryPoints: [path.join(root, "src/sw/sw.ts")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  outfile: path.join(publicDir, "sw.js"),
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  logLevel: "warning",
});

console.log(`Service worker byggd: build ${buildId}, ${entries.length} filer, ${(manifest.totalBytes / 1024).toFixed(0)} kB att ladda ned offline (varav ${manifest.imageFiles} bildfiler, ${(manifest.imageBytes / 1024).toFixed(0)} kB).`);
