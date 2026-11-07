import type { Photo } from "./schema";

/**
 * Slumpad introduktionsbild på startsidan.
 *
 * Urvalet görs i webbläsaren, en gång per sidladdning, av ett litet inbäddat skript (START_IMAGE_RUNTIME) som körs innan
 * första målning. Servern renderar bara ett skal (utan bildfil) och en kompakt datalista över kandidaterna, så att bara
 * den valda bildens filer hämtas. Samma skript körs av en klientkomponent vid mjuk navigering, där inbäddade skript inte körs.
 * Allt ligger i sidans HTML och i befintliga bildfiler, så slumpningen fungerar även offline.
 */

/** Nyckel i localStorage för föregående bild (så att samma bild inte visas två gånger i rad). */
export const START_IMAGE_STORAGE_KEY = "japanresan:startbild:v1";

/** Urvalsfunktionen som JavaScript-källa (ES5). Används i skriptet och testas direkt med injicerad slumpfunktion. */
export const PICK_SOURCE = `function(ids,prev,rnd){
var n=ids.length;if(!n)return null;
var pool=ids;
if(n>1&&prev){pool=[];for(var i=0;i<n;i++){if(ids[i]!==prev)pool.push(ids[i]);}if(!pool.length)pool=ids;}
var r=rnd();if(!(r>=0&&r<1))r=0;
return pool[Math.floor(r*pool.length)];
}`;

/** Kompakt beskrivning av en kandidat. Allt kommer ur bildregistret; inget dupliceras för hand. */
export interface StartItem {
  id: string;
  alt: string;
  /** Bildtext */
  cap: string;
  /** object-position, från bildens fokuspunkt */
  pos: string;
  src: string;
  w: number;
  h: number;
  /** srcset för standardbeskärningen */
  ss: string;
  /** srcset för mobilbeskärningen (tom om saknas) */
  ms: string;
  /** Fotograf, källa, licens */
  cr: string;
  pl: string;
  su: string;
  ln: string;
  lu: string;
}

export interface StartData {
  fallback: string;
  items: StartItem[];
}

const FRAME = "aspect-[3/2] overflow-hidden rounded-xl bg-paper-2";
const SIZES = "(min-width: 768px) 384px, 100vw";

export function toStartItem(photo: Photo, platformLabel: string): StartItem {
  const def = photo.variants.filter((v) => v.crop === "default" && v.format === "webp").sort((a, b) => a.width - b.width);
  const mob = photo.variants.filter((v) => v.crop === "mobile" && v.format === "webp").sort((a, b) => a.width - b.width);
  const largest = def[def.length - 1];
  const srcset = (vs: typeof def) => vs.map((v) => `${v.path} ${v.width}w`).join(", ");
  return {
    id: photo.id,
    alt: photo.alt,
    cap: photo.caption,
    pos: `${Math.round(photo.focus.x * 100)}% ${Math.round(photo.focus.y * 100)}%`,
    src: largest.path,
    w: largest.width,
    h: largest.height,
    ss: srcset(def),
    ms: srcset(mob),
    cr: photo.creator,
    pl: platformLabel,
    su: photo.sourceUrl,
    ln: photo.license.name,
    lu: photo.license.url,
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Innehållet i startbildens <figure>: ett skal utan bildfil (så att ingen standardbild hämtas i onödan),
 * en reservbild i <noscript> för besökare utan JavaScript, och reservbildens bildtext.
 */
export function startFigureHtml(fallback: StartItem): string {
  const mobile = fallback.ms ? `<source media="(max-width: 639px)" type="image/webp" srcset="${esc(fallback.ms)}" sizes="100vw">` : "";
  const noscript = `<noscript><picture>${mobile}<img src="${esc(fallback.src)}" srcset="${esc(fallback.ss)}" sizes="${SIZES}" width="${fallback.w}" height="${fallback.h}" alt="${esc(fallback.alt)}" class="h-full w-full object-cover" style="object-position:${fallback.pos}"></picture></noscript>`;
  return (
    `<div class="${FRAME}"><picture id="start-hero-picture"><img id="start-hero-img" class="h-full w-full object-cover" alt="" width="${fallback.w}" height="${fallback.h}" decoding="async"></picture>${noscript}</div>` +
    `<figcaption id="start-hero-caption" class="text-sm text-ink-soft">${esc(fallback.cap)}</figcaption>`
  );
}

/** Rad i ”Bilder och rättigheter” för en bild: fotograf · källa · licens, med länkar. */
export function startCreditHtml(item: StartItem): string {
  return `${esc(item.cr)} · <a href="${esc(item.su)}" target="_blank" rel="noopener noreferrer">${esc(item.pl)}</a> · <a href="${esc(item.lu)}" target="_blank" rel="noopener noreferrer">${esc(item.ln)}</a>`;
}

/** JSON för inbäddning i <script type="application/json">: ”<” maskeras så att inget kan avsluta elementet i förtid. */
export function startDataJson(data: StartData): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").split(String.fromCharCode(0x2028)).join("\\u2028").split(String.fromCharCode(0x2029)).join("\\u2029");
}

/**
 * Skriptet som väljer och visar bilden. Idempotent (märker figuren med data-ready) och försiktigt: allt som kan
 * kasta (lagring, JSON, urval) fångas, och vid fel eller om bildfilen inte kan laddas visas reservbilden.
 */
export const START_IMAGE_RUNTIME = `(function(){
var KEY=${JSON.stringify(START_IMAGE_STORAGE_KEY)};
var pick=(${PICK_SOURCE});
function $(i){return document.getElementById(i);}
var fig=$("start-hero");
if(!fig||fig.getAttribute("data-ready"))return;
var raw=$("start-image-data");
if(!raw)return;
var data;
try{data=JSON.parse(raw.textContent);}catch(e){return;}
var items=data.items||[],by={},ids=[],i;
for(i=0;i<items.length;i++){by[items[i].id]=items[i];ids.push(items[i].id);}
var cur=null;
function show(id){
var it=by[id];
var pic=$("start-hero-picture"),img=$("start-hero-img"),cap=$("start-hero-caption"),cr=$("start-credit");
if(!it||!pic||!img)return false;
var old=pic.querySelectorAll("source"),k;
for(k=0;k<old.length;k++){pic.removeChild(old[k]);}
if(it.ms){var s=document.createElement("source");s.media="(max-width: 639px)";s.type="image/webp";s.sizes="100vw";s.srcset=it.ms;pic.insertBefore(s,img);}
cur=id;
img.alt=it.alt;img.width=it.w;img.height=it.h;
img.setAttribute("loading","eager");img.setAttribute("fetchpriority","high");
img.style.objectPosition=it.pos;
img.sizes=${JSON.stringify(SIZES)};
img.srcset=it.ss;
img.src=it.src;
if(cap)cap.textContent=it.cap;
if(cr){
while(cr.firstChild)cr.removeChild(cr.firstChild);
cr.appendChild(document.createTextNode(it.cr+" \\u00b7 "));
var a1=document.createElement("a");a1.href=it.su;a1.target="_blank";a1.rel="noopener noreferrer";a1.textContent=it.pl;cr.appendChild(a1);
cr.appendChild(document.createTextNode(" \\u00b7 "));
var a2=document.createElement("a");a2.href=it.lu;a2.target="_blank";a2.rel="noopener noreferrer";a2.textContent=it.ln;cr.appendChild(a2);
cr.setAttribute("data-testid","rights-"+id);
}
fig.setAttribute("data-start-image",id);
return true;
}
var img0=$("start-hero-img");
if(img0)img0.onerror=function(){if(cur!==data.fallback){show(data.fallback);}};
var prev=null;
try{prev=window.localStorage.getItem(KEY);}catch(e){}
var id=null;
try{id=pick(ids,prev,Math.random);}catch(e){}
if(!id||!by[id])id=data.fallback;
if(!show(id))show(data.fallback);
try{window.localStorage.setItem(KEY,cur||id);}catch(e){}
fig.setAttribute("data-ready","1");
})();`;
