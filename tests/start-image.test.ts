import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Photo } from "@/lib/schema";
import {
  PICK_SOURCE,
  START_IMAGE_RUNTIME,
  START_IMAGE_STORAGE_KEY,
  startCreditHtml,
  startDataJson,
  startFigureHtml,
  toStartItem,
  type StartData,
  type StartItem,
} from "@/lib/start-image";

const root = path.join(process.cwd(), "src", "content");
const photos: Photo[] = JSON.parse(fs.readFileSync(path.join(root, "images.json"), "utf8"));
const home = JSON.parse(fs.readFileSync(path.join(root, "home.json"), "utf8")) as { hero: { imageId: string }; startImages: string[] };

const platform: Record<string, string> = { "wikimedia-commons": "Wikimedia Commons" };
const itemsAll: StartItem[] = home.startImages.map((id) => {
  const p = photos.find((x) => x.id === id)!;
  return toStartItem(p, platform[p.sourcePlatform] ?? "Källa");
});
const data: StartData = { fallback: home.hero.imageId, items: itemsAll };

const pick = new Function(`return (${PICK_SOURCE});`)() as (ids: string[], prev: string | null, rnd: () => number) => string | null;

function mount(d: StartData = data) {
  const fb = d.items.find((i) => i.id === d.fallback)!;
  document.body.innerHTML =
    `<figure id="start-hero" class="space-y-2" data-start-image="${fb.id}">${startFigureHtml(fb)}</figure>` +
    `<script id="start-image-data" type="application/json">${startDataJson(d)}</script>` +
    `<ul><li id="start-credit" data-testid="rights-${fb.id}">${startCreditHtml(fb)}</li></ul>`;
}
const run = () => window.eval(START_IMAGE_RUNTIME);
const shown = () => document.getElementById("start-hero")!.getAttribute("data-start-image")!;

describe("urvalet av startbild (ren logik)", () => {
  const ids = ["a", "b", "c", "d"];
  it("väljer deterministiskt ur slumptalet", () => {
    expect(pick(ids, null, () => 0)).toBe("a");
    expect(pick(ids, null, () => 0.5)).toBe("c");
    expect(pick(ids, null, () => 0.999999)).toBe("d");
  });
  it("utesluter föregående bild när minst två finns, för alla möjliga slumptal", () => {
    for (const prev of ids) for (let i = 0; i < 100; i++) expect(pick(ids, prev, () => i / 100)).not.toBe(prev);
  });
  it("kan välja alla andra bilder (ingen bild blir omöjlig)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) seen.add(pick(ids, "b", () => i / 30)!);
    expect([...seen].sort()).toEqual(["a", "c", "d"]);
  });
  it("hanterar en enda bild, tom lista, okänd föregående bild och orimligt slumptal", () => {
    expect(pick(["a"], "a", () => 0.7)).toBe("a");
    expect(pick([], null, () => 0.3)).toBeNull();
    expect(pick(ids, "finns-inte", () => 0)).toBe("a");
    expect(pick(ids, null, () => NaN)).toBe("a");
    expect(pick(ids, null, () => 1.5)).toBe("a");
  });
});

describe("startbildens urval i innehållet", () => {
  it("ungefär 20 bilder, alla fotografier med bildtext, alt-text och licens, och variation i motiv", () => {
    expect(home.startImages.length).toBeGreaterThanOrEqual(15);
    expect(home.startImages.length).toBeLessThanOrEqual(25);
    expect(new Set(home.startImages).size).toBe(home.startImages.length);
    expect(home.startImages).toContain(home.hero.imageId);
    for (const id of home.startImages) {
      const p = photos.find((x) => x.id === id)!;
      expect(p, id).toBeTruthy();
      expect(p.kind, id).toBe("contemporary-photo");
      expect(p.decorative, id).toBe(false);
      expect(p.alt.length, id).toBeGreaterThan(30);
      expect(p.usedIn, id).toContain("home");
    }
  });
  it("bildtexterna är en till två korta meningar utan länkar, filnamn eller interna ID", () => {
    for (const it of itemsAll) {
      const sentences = it.cap.split(/(?<=[.!?])\s+/).filter(Boolean);
      expect(sentences.length, it.id).toBeGreaterThanOrEqual(1);
      expect(sentences.length, it.id).toBeLessThanOrEqual(2);
      expect(it.cap.length, it.id).toBeLessThanOrEqual(170);
      expect(it.cap, it.id).not.toMatch(/https?:|www\.|\.jpe?g|\.png|\.webp|Commons|File:|t\d\d-k\d\d/);
      expect(it.cap, it.id).not.toContain(it.id);
    }
  });
  it("alla bildfiler som kandidaterna använder finns, och varje kandidat har uppgifter om fotograf, källa och licens", () => {
    for (const it of itemsAll) {
      const p = photos.find((x) => x.id === it.id)!;
      for (const v of p.variants) expect(fs.existsSync(path.join(process.cwd(), "public", v.path)), v.path).toBe(true);
      expect(it.ss.length, it.id).toBeGreaterThan(0);
      expect(it.cr && it.pl && it.su && it.ln && it.lu, it.id).toBeTruthy();
      expect(it.su).toMatch(/^https:\/\//);
      expect(it.lu).toMatch(/^https:\/\//);
    }
  });
  it("kompakt klientdata (under cirka 25 kB)", () => {
    expect(startDataJson(data).length).toBeLessThan(25_000);
  });
});

describe("skriptet som visar startbilden (jsdom)", () => {
  beforeEach(() => mount());
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("visar vald bild med matchande alt, bildtext och kreditering", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    run();
    const id = shown();
    const it = itemsAll.find((i) => i.id === id)!;
    const img = document.getElementById("start-hero-img") as HTMLImageElement;
    expect(img.alt).toBe(it.alt);
    expect(img.getAttribute("src")).toBe(it.src);
    expect(img.getAttribute("srcset")).toBe(it.ss);
    expect(img.style.objectPosition).toBe(it.pos);
    expect(document.getElementById("start-hero-caption")!.textContent).toBe(it.cap);
    const cr = document.getElementById("start-credit")!;
    expect(cr.getAttribute("data-testid")).toBe(`rights-${id}`);
    expect(cr.textContent).toBe(`${it.cr} · ${it.pl} · ${it.ln}`);
    const links = [...cr.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(links).toEqual([it.su, it.lu]);
    expect(document.getElementById("start-hero")!.getAttribute("data-ready")).toBe("1");
  });

  it("varje kandidat visas korrekt och mobilbeskärningen följer med", () => {
    for (let i = 0; i < itemsAll.length; i++) {
      mount();
      // Index i bland kandidaterna (ingen tidigare bild lagrad)
      vi.spyOn(Math, "random").mockReturnValue(i / itemsAll.length);
      window.localStorage.clear();
      run();
      const it = itemsAll[i];
      expect(shown()).toBe(it.id);
      const sources = document.querySelectorAll("#start-hero-picture source");
      expect(sources.length).toBe(it.ms ? 1 : 0);
      if (it.ms) expect(sources[0].getAttribute("srcset")).toBe(it.ms);
      expect((document.getElementById("start-hero-img") as HTMLImageElement).alt).toBe(it.alt);
      vi.restoreAllMocks();
    }
  });

  it("slumpar inte om vid ett nytt anrop eller en omrendering (idempotent)", () => {
    const r = vi.spyOn(Math, "random");
    r.mockReturnValue(0.1);
    run();
    const first = shown();
    r.mockReturnValue(0.9);
    run();
    run();
    expect(shown()).toBe(first);
  });

  it("utesluter föregående bild från lagringen och sparar den nya", () => {
    for (let k = 0; k < 40; k++) {
      mount();
      window.localStorage.setItem(START_IMAGE_STORAGE_KEY, "yakushima-anbo");
      vi.spyOn(Math, "random").mockReturnValue(k / 40);
      run();
      expect(shown()).not.toBe("yakushima-anbo");
      expect(window.localStorage.getItem(START_IMAGE_STORAGE_KEY)).toBe(shown());
      vi.restoreAllMocks();
    }
  });

  it("fungerar när lokal lagring är blockerad (både läsning och skrivning kastar)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blockerad");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blockerad");
    });
    vi.spyOn(Math, "random").mockReturnValue(0.3);
    expect(() => run()).not.toThrow();
    const it = itemsAll.find((i) => i.id === shown())!;
    expect((document.getElementById("start-hero-img") as HTMLImageElement).alt).toBe(it.alt);
    expect(document.getElementById("start-hero")!.getAttribute("data-ready")).toBe("1");
  });

  it("faller tillbaka på reservbilden om urvalet kastar eller ger okänd bild", () => {
    vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("fel");
    });
    run();
    expect(shown()).toBe(data.fallback);
    const fb = itemsAll.find((i) => i.id === data.fallback)!;
    expect(document.getElementById("start-hero-caption")!.textContent).toBe(fb.cap);
  });

  it("byter till reservbilden, med matchande text och kreditering, om den valda bildfilen inte kan laddas", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.55);
    run();
    const chosen = shown();
    expect(chosen).not.toBe(data.fallback);
    (document.getElementById("start-hero-img") as HTMLImageElement).onerror!(new Event("error"));
    expect(shown()).toBe(data.fallback);
    const fb = itemsAll.find((i) => i.id === data.fallback)!;
    expect(document.getElementById("start-hero-caption")!.textContent).toBe(fb.cap);
    expect((document.getElementById("start-hero-img") as HTMLImageElement).alt).toBe(fb.alt);
    expect(document.getElementById("start-credit")!.getAttribute("data-testid")).toBe(`rights-${fb.id}`);
  });

  it("gör ingenting (och kastar inte) om data saknas eller är trasig", () => {
    document.getElementById("start-image-data")!.textContent = "{inte json";
    expect(() => run()).not.toThrow();
    expect((document.getElementById("start-hero-img") as HTMLImageElement).getAttribute("src")).toBeNull();
    document.getElementById("start-image-data")!.remove();
    expect(() => run()).not.toThrow();
  });

  it("skalet innehåller ingen bildfil i img, och reservbilden finns i noscript", () => {
    const html = startFigureHtml(itemsAll.find((i) => i.id === data.fallback)!);
    const img = /<img id="start-hero-img"[^>]*>/.exec(html)![0];
    expect(img).not.toMatch(/\ssrc=|srcset=/);
    expect(html).toMatch(/<noscript><picture>/);
  });

  it("JSON-data kan inte avsluta script-elementet i förtid", () => {
    const evil: StartData = { fallback: "x", items: [{ ...itemsAll[0], id: "x", cap: "</script><b>" }] };
    expect(startDataJson(evil)).not.toContain("</script>");
    expect(JSON.parse(startDataJson(evil)).items[0].cap).toBe("</script><b>");
  });
});
