import fs from "node:fs";
import path from "node:path";
import sharp, { type Sharp } from "sharp";
import type { ImageVariant } from "../src/lib/schema";

export interface OptimizeOptions {
  /** Kameraoriginal eller nedladdad fil (lagras aldrig i repot). */
  input: string;
  id: string;
  /** Katalogen som motsvarar webbens rot (normalt ./public). */
  publicDir: string;
  widths?: number[];
  quality?: number;
  /** Fokuspunkt 0–1, används vid mobilbeskärning. */
  focus?: { x: number; y: number };
  /** Skapa även en stående beskärning (4:5) för smala skärmar. */
  mobile?: boolean;
  /** Mål för största varianten. Kvaliteten sänks stegvis (ned till 45) om filen blir större. */
  targetBytes?: number;
}

export async function optimizeImage(o: OptimizeOptions): Promise<{ variants: ImageVariant[]; source: { width: number; height: number } }> {
  const widths = o.widths ?? [480, 960, 1440];
  const targetBytes = o.targetBytes ?? 250 * 1024;
  const focus = o.focus ?? { x: 0.5, y: 0.5 };
  const dir = path.join(o.publicDir, "images", o.id);
  fs.mkdirSync(dir, { recursive: true });

  // rotate() tillämpar EXIF-orientering. sharp tar bort metadata (inkl. GPS) om withMetadata inte anropas.
  const base = sharp(o.input).rotate();
  const meta = await sharp(await base.clone().toBuffer()).metadata();
  const sw = meta.width!;
  const sh = meta.height!;
  const variants: ImageVariant[] = [];

  async function encode(pipeline: Sharp, name: string, crop: ImageVariant["crop"]) {
    let q = o.quality ?? 72;
    let buf = await pipeline.clone().webp({ quality: q, effort: 5 }).toBuffer();
    while (buf.length > targetBytes && q > 45) {
      q -= 5;
      buf = await pipeline.clone().webp({ quality: q, effort: 5 }).toBuffer();
    }
    const info = await sharp(buf).metadata();
    const file = path.join(dir, name);
    fs.writeFileSync(file, buf);
    variants.push({ path: `/images/${o.id}/${name}`, width: info.width!, height: info.height!, bytes: buf.length, format: "webp", crop });
  }

  for (const w of widths.filter((w) => w <= sw).concat(widths.every((w) => w > sw) ? [sw] : [])) {
    await encode(base.clone().resize({ width: w, withoutEnlargement: true }), `${o.id}-${w}.webp`, "default");
  }

  if (o.mobile) {
    // Stående 4:5-beskärning runt fokuspunkten.
    const cropW = Math.min(sw, Math.round((sh * 4) / 5));
    const cropH = Math.min(sh, Math.round((cropW * 5) / 4));
    const left = Math.max(0, Math.min(sw - cropW, Math.round(focus.x * sw - cropW / 2)));
    const top = Math.max(0, Math.min(sh - cropH, Math.round(focus.y * sh - cropH / 2)));
    const cropped = base.clone().extract({ left, top, width: cropW, height: cropH });
    for (const w of [480, 800].filter((w) => w <= cropW)) {
      await encode(cropped.clone().resize({ width: w }), `${o.id}-m${w}.webp`, "mobile");
    }
  }
  return { variants, source: { width: sw, height: sh } };
}
