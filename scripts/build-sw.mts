/**
 * Efterbygge: skapar out/offline-manifest.json och out/sw.js ur det exporterade bygget.
 * Körs efter `next build` (se package.json).
 */
import { build } from "esbuild";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const out = path.join(process.cwd(), "out");
if (!fs.existsSync(out)) throw new Error("Katalogen out/ saknas. Kör next build först.");

const EXCLUDE = new Set(["sw.js", "offline-manifest.json"]);
const files: { url: string; size: number; hash: string }[] = [];

function walk(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else {
      const rel = path.relative(out, full).split(path.sep).join("/");
      if (EXCLUDE.has(rel) || rel.endsWith(".map")) continue;
      const buf = fs.readFileSync(full);
      files.push({ url: "/" + rel, size: buf.length, hash: createHash("sha1").update(buf).digest("hex").slice(0, 12) });
    }
  }
}
walk(out);
files.sort((a, b) => a.url.localeCompare(b.url));

const buildId = createHash("sha1").update(files.map((f) => f.url + f.hash).join("\n")).digest("hex").slice(0, 10);

// Sidor ska också kunna hittas via adressen utan filnamn (/kapitel/x/ → /kapitel/x/index.html).
const urls = files.map((f) => ({ url: f.url.endsWith("/index.html") ? f.url.slice(0, -"index.html".length) : f.url, size: f.size }));

const manifest = {
  buildId,
  generatedAt: new Date().toISOString(),
  totalBytes: files.reduce((n, f) => n + f.size, 0),
  files: urls,
};
fs.writeFileSync(path.join(out, "offline-manifest.json"), JSON.stringify(manifest));

await build({
  entryPoints: [path.join(process.cwd(), "src/sw/sw.ts")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  outfile: path.join(out, "sw.js"),
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  logLevel: "warning",
});

console.log(`Service worker byggd: build ${buildId}, ${files.length} filer, ${(manifest.totalBytes / 1024).toFixed(0)} kB att ladda ned offline.`);
