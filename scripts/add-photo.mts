/**
 * Lägger till ett fotografi i bildregistret efter manuell rättighetskontroll.
 *
 *   npm run images:add -- <spec.json>
 *
 * spec.json innehåller registerfälten (se photoSchema i src/lib/schema.ts) utom `variants`/`focus`, samt:
 *   "input": sökväg till den lokalt hämtade filen (hamnar aldrig i repot)
 *   "mobile": true för att även skapa en 4:3-beskärning för mobil
 *   "preCrop": { "left": 0.02, "right": 0.02, "top": 0, "bottom": 0.08 } tar bort marginaler (andel) före bearbetning
 *   "focus": { "x": 0.5, "y": 0.5 }
 *   "slot": id på bildplatsen att koppla (hero/photo-block/home) - kopplas i innehållsfilerna
 * Skriptet optimerar bilden, validerar posten mot schemat och skriver src/content/images.json.
 */
import fs from "node:fs";
import path from "node:path";
import { photoSchema } from "../src/lib/schema";
import { optimizeImage } from "./optimize-image-lib";
import { linkPhotoToSlot } from "./slots-lib";

const specFile = process.argv[2];
if (!specFile) {
  console.error("Användning: npm run images:add -- <spec.json>");
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(specFile, "utf8"));
const { input, mobile, slot, slots, widths, preCrop, ...rest } = spec;
const focus = rest.focus ?? { x: 0.5, y: 0.5 };
const res = await optimizeImage({ input, id: rest.id, publicDir: path.join(process.cwd(), "public"), focus, mobile: Boolean(mobile), widths, preCrop });
const entry = { ...rest, focus, variants: res.variants, usedIn: rest.usedIn ?? ["pending"] };
const parsed = photoSchema.safeParse(entry);
if (!parsed.success) {
  console.error("Ogiltig registerpost:\n" + parsed.error.issues.map((i) => ` - ${i.path.join(".")}: ${i.message}`).join("\n"));
  process.exit(1);
}
const regPath = path.join(process.cwd(), "src/content/images.json");
const reg = JSON.parse(fs.readFileSync(regPath, "utf8")) as { id: string }[];
const next = [...reg.filter((p) => p.id !== parsed.data.id), parsed.data].sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(regPath, JSON.stringify(next, null, 2) + "\n");
for (const sl of [slot, ...(slots ?? [])].filter(Boolean) as string[]) console.log(`  kopplad till ${sl} (${linkPhotoToSlot(parsed.data.id, sl)})`);
console.log(`Registrerade ${parsed.data.id}: ${res.variants.map((v) => `${v.width}px ${(v.bytes / 1024).toFixed(0)} kB`).join(", ")}${slot ? ` (bildplats ${slot})` : ""}`);
