/**
 * Optimerar ett fotografi till lokala webbvarianter (WebP) i public/images/<id>/.
 *
 *   npm run images:optimize -- <originalfil> <id> [--focus 0.5,0.4] [--mobile]
 *
 * Skriver ut variantlistan att klistra in i src/content/images.json. Originalet kopieras aldrig in i repot.
 * Registerposten (fotograf, licens, källa, kontrolldatum, bildtext, alt-text ...) fylls i för hand
 * efter att rättigheterna kontrollerats på originalets informationssida. Se docs/IMAGE-LICENSES.md.
 */
import path from "node:path";
import { optimizeImage } from "./optimize-image-lib";

const args = process.argv.slice(2);
const [input, id] = args.filter((a) => !a.startsWith("--"));
if (!input || !id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
  console.error("Användning: npm run images:optimize -- <originalfil> <id> [--focus x,y] [--mobile]");
  process.exit(1);
}
const focusArg = args.find((a) => a.startsWith("--focus"));
const focusVal = focusArg ? (focusArg.includes("=") ? focusArg.split("=")[1] : args[args.indexOf(focusArg) + 1]) : undefined;
const [fx, fy] = focusVal ? focusVal.split(",").map(Number) : [0.5, 0.5];

const res = await optimizeImage({ input, id, publicDir: path.join(process.cwd(), "public"), focus: { x: fx, y: fy }, mobile: args.includes("--mobile") });
console.log(`Original: ${res.source.width}×${res.source.height}px`);
for (const v of res.variants) console.log(`  ${v.path}  ${v.width}×${v.height}  ${(v.bytes / 1024).toFixed(0)} kB`);
console.log("\nKlistra in i registerposten:");
console.log(JSON.stringify({ focus: { x: fx, y: fy }, variants: res.variants }, null, 2));
