// Genererar public/media/japan-karta.svg ur Natural Earth (public domain) via paketet world-atlas.
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import { geoMercator, geoPath } from "d3-geo";

const topo = JSON.parse(readFileSync("node_modules/world-atlas/countries-50m.json", "utf8"));
const all = feature(topo, topo.objects.countries);
const japan = all.features.find((f) => f.properties.name === "Japan");
if (!japan) throw new Error("Japan saknas i datat");

// Ta bort de avlägsna Ogasawara-öarna för att kartan ska bli tydlig (lon>141.5 & lat<30)
const polys = japan.geometry.coordinates.filter((poly) => {
  const [lon, lat] = poly[0][0];
  return !(lat < 29 && lon > 138);
});
const geo = { type: "Feature", geometry: { type: "MultiPolygon", coordinates: polys } };

const W = 640, H = 760;
const proj = geoMercator().fitExtent([[20, 20], [W - 20, H - 20]], geo);
const path = geoPath(proj);
const d = path(geo);

const cities = [
  ["Sapporo", 43.06, 141.35, "start", 10, -8],
  ["Tokyo", 35.68, 139.69, "start", 12, 4],
  ["Kyoto", 35.01, 135.77, "end", -10, -8],
  ["Osaka", 34.69, 135.5, "end", -10, 14],
  ["Hiroshima", 34.39, 132.46, "end", -10, 4],
  ["Fukuoka", 33.59, 130.4, "end", -10, -6],
  ["Naha", 26.21, 127.68, "end", -10, 4],
];
const marks = cities.map(([n, lat, lon, anchor, dx, dy]) => {
  const [x, y] = proj([lon, lat]);
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="#b3261e" stroke="#fff" stroke-width="2"/><text x="${(x + dx).toFixed(1)}" y="${(y + dy).toFixed(1)}" text-anchor="${anchor}" font-size="17" font-family="system-ui, sans-serif" font-weight="600" fill="#1b2340" paint-order="stroke" stroke="#fdf8ef" stroke-width="4">${n}</text>`;
}).join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
<title id="t">Förenklad karta över Japan med sju städer</title>
<desc id="d">Japans öar sedda från ovan, med Sapporo på Hokkaido i norr, Tokyo, Kyoto och Osaka på Honshu, Hiroshima i väster på Honshu, Fukuoka på Kyushu och Naha på Okinawa i söder.</desc>
<rect width="${W}" height="${H}" fill="#e9eef7"/>
<path d="${d}" fill="#f3e7cf" stroke="#4a5578" stroke-width="1.2" stroke-linejoin="round"/>
${marks}
</svg>
`;
writeFileSync("public/media/japan-karta.svg", svg);
const pts = Object.fromEntries(cities.map(([n, lat, lon]) => [n, proj([lon, lat]).map((v) => +v.toFixed(0))]));
console.log("ok", svg.length, JSON.stringify(pts));
