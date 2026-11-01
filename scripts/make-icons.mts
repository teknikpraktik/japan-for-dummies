/**
 * Genererar PNG-ikoner ur enkel egen SVG-grafik med Playwrights Chromium.
 * Körs vid behov (resultatet checkas in): npm run make:icons
 * Sätt CHROMIUM_PATH om webbläsaren ligger på annan plats.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const outDir = path.join(process.cwd(), "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

/** Egen grafik: indigo bakgrund, ljus skiva och röd cirkel. Ingen tredjepartsgrafik. */
const svg = (pad: number, rounded: boolean) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#28356b" ${rounded ? 'rx="96"' : ""}/>
  <g transform="translate(256 256) scale(${1 - pad}) translate(-256 -256)">
    <circle cx="256" cy="256" r="170" fill="#fbf6ec"/>
    <circle cx="256" cy="256" r="84" fill="#a8201a"/>
  </g>
</svg>`;

const jobs = [
  { file: "icon-192.png", size: 192, pad: 0, rounded: true },
  { file: "icon-512.png", size: 512, pad: 0, rounded: true },
  { file: "icon-maskable-512.png", size: 512, pad: 0.12, rounded: false },
  { file: "apple-touch-icon.png", size: 180, pad: 0.05, rounded: false },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage();
for (const j of jobs) {
  await page.setViewportSize({ width: j.size, height: j.size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(j.pad, j.rounded).replace('width="512" height="512"', `width="${j.size}" height="${j.size}"`)}</body></html>`);
  await page.screenshot({ path: path.join(outDir, j.file), omitBackground: true, clip: { x: 0, y: 0, width: j.size, height: j.size } });
  console.log("skapade", j.file);
}
await browser.close();
