import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import sharp from "sharp";
import { validateContent, type FileAccess, type RawContent } from "@/lib/content-validate";
import { missingFromManifest, imageStats } from "@/lib/image-manifest";
import { optimizeImage } from "../scripts/optimize-image-lib";
import type { Photo } from "@/lib/schema";

vi.mock("server-only", () => ({}));
const state: { photos: Photo[] } = { photos: [] };
vi.mock("@/lib/content", () => ({ getContent: () => ({ photos: state.photos }) }));

const root = path.join(process.cwd(), "src", "content");
const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
function loadRaw(): RawContent {
  const chapters: RawContent["chapters"] = [];
  for (const dir of ["chapters", "planned"])
    for (const f of fs.readdirSync(path.join(root, dir)).filter((n) => n.endsWith(".json"))) {
      const data = read(`${dir}/${f}`);
      if (Array.isArray(data)) data.forEach((d, i) => chapters.push({ file: `${f}[${i}]`, data: d }));
      else chapters.push({ file: f, data });
    }
  const raw: RawContent = { trip: read("trip.json"), themes: read("themes.json"), sources: read("sources.json"), media: read("media.json"), home: read("home.json"), images: read("images.json"), chapters };
  return raw;
}
/** Innehåll utan några kopplade bilder, som bas för fixtur-tester. */
function loadRawWithoutImages(): RawContent {
  const raw = structuredClone(loadRaw());
  (raw.home as { hero: { imageId: string | null }; startImages: string[] }).hero.imageId = null;
  (raw.home as { startImages: string[] }).startImages = [];
  for (const c of raw.chapters) {
    const d = c.data as { status: string; hero?: { imageId: string | null }; sections?: { blocks: { type: string; imageId?: string | null }[] }[] };
    if (d.status !== "published") continue;
    d.hero!.imageId = null;
    for (const sec of d.sections!) for (const b of sec.blocks) if (b.type === "photo") b.imageId = null;
  }
  raw.images = [];
  return raw;
}

const validPhoto = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "testbild",
  kind: "contemporary-photo",
  variants: [
    { path: "/images/testbild/testbild-640.webp", width: 640, height: 427, bytes: 40_000, format: "webp", crop: "default" },
    { path: "/images/testbild/testbild-1280.webp", width: 1280, height: 853, bytes: 120_000, format: "webp", crop: "default" },
  ],
  focus: { x: 0.4, y: 0.6 },
  creator: "Testperson",
  sourcePlatform: "other",
  sourceUrl: "https://example.org/foto/1",
  license: { name: "Testlicens", url: "https://example.org/licens" },
  rightsCheckedOn: "2026-11-01",
  rightsCheckedBy: "Testgranskare",
  licenseEvidence: "Licensruta på originalsidan lästes; villkoren medger vår användning.",
  requiredCredit: null,
  usageCleared: { webPublishing: true, offlinePackage: true, modification: true, publicRepoStorage: true },
  caption: "En testbild.",
  alt: "En beskrivande alternativtext för testbilden.",
  decorative: false,
  modification: "Beskuren och nedskalad.",
  usedIn: ["home"],
  ...over,
});
const files = (sizes: Record<string, number>): FileAccess => ({ size: (p) => sizes[p] });
const okSizes = { "/images/testbild/testbild-640.webp": 40_000, "/images/testbild/testbild-1280.webp": 120_000 };
function withPhoto(photo: unknown) {
  const raw = loadRawWithoutImages();
  raw.images = [photo];
  (raw.home as { hero: { imageId: string | null } }).hero.imageId = "testbild";
  (raw.home as { startImages: string[] }).startImages = ["testbild"];
  return raw;
}

describe("bildkontroll", () => {
  it("bildregistret utan kopplade bilder är giltigt (tomma bildplatser tillåts)", () => {
    expect(validateContent(loadRawWithoutImages(), files({})).errors).toEqual([]);
  });
  it("det verkliga bildregistret: alla filer finns lokalt, med rätt storlek, och metadata är komplett", async () => {
    const { publicFiles } = await import("@/lib/file-access");
    const r = validateContent(loadRaw(), publicFiles());
    expect(r.errors).toEqual([]);
    expect(r.content!.photos.length).toBeGreaterThanOrEqual(15);
    for (const p of r.content!.photos) {
      expect(p.usageCleared).toEqual({ webPublishing: true, offlinePackage: true, modification: true, publicRepoStorage: true });
      expect(p.license.url).toMatch(/^https:\/\//);
      expect(p.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(p.licenseEvidence.length).toBeGreaterThan(40);
      expect(p.variants.every((v) => v.path.startsWith("/images/"))).toBe(true);
    }
  });
  it("startbildspoolen: okänd bild, dubblett, dekorativ bild och reservbild utanför poolen avvisas", () => {
    const base = () => withPhoto(validPhoto());
    const set = (r: ReturnType<typeof base>, ids: string[]) => ((r.home as { startImages: string[] }).startImages = ids);
    const r1 = base(); set(r1, ["testbild", "finns-inte"]);
    expect(validateContent(r1, files(okSizes)).errors.some((e) => e.includes("okänd bild finns-inte"))).toBe(true);
    const r2 = base(); set(r2, ["testbild", "testbild"]);
    expect(validateContent(r2, files(okSizes)).errors.some((e) => e.includes("flera gånger"))).toBe(true);
    const r3 = withPhoto(validPhoto({ decorative: true, alt: "" }));
    expect(validateContent(r3, files(okSizes)).errors.some((e) => e.includes("dekorativ"))).toBe(true);
    const r5 = withPhoto(validPhoto({ usedIn: ["t01-k01"] }));
    expect(validateContent(r5, files(okSizes)).errors.some((e) => e.includes("saknar home i usedIn"))).toBe(true);
  });
  it("en komplett bild med filer godkänns", () => {
    const r = validateContent(withPhoto(validPhoto()), files(okSizes));
    expect(r.errors).toEqual([]);
  });
  it("fångar saknad lokal bildfil", () => {
    const r = validateContent(withPhoto(validPhoto()), files({ "/images/testbild/testbild-640.webp": 40_000 }));
    expect(r.errors.some((e) => e.includes("filen saknas lokalt"))).toBe(true);
  });
  it("fångar felaktig filstorlek i registret och för stora filer", () => {
    expect(validateContent(withPhoto(validPhoto()), files({ ...okSizes, "/images/testbild/testbild-640.webp": 41_000 })).errors.some((e) => e.includes("stämmer inte"))).toBe(true);
    const big = validPhoto({ variants: [{ path: "/images/testbild/stor.webp", width: 2000, height: 1000, bytes: 500_000, format: "webp", crop: "default" }] });
    expect(validateContent(withPhoto(big), files({ "/images/testbild/stor.webp": 500_000 })).errors.some((e) => e.includes("för stor"))).toBe(true);
  });
  it("varnar för bilder över rekommenderad storlek men godkänner dem", () => {
    const mid = validPhoto({ variants: [{ path: "/images/testbild/mellan.webp", width: 1600, height: 900, bytes: 300_000, format: "webp", crop: "default" }] });
    const r = validateContent(withPhoto(mid), files({ "/images/testbild/mellan.webp": 300_000 }));
    expect(r.errors).toEqual([]);
    expect(r.content!.warnings.length).toBe(1);
  });
  for (const [name, field] of [["fotograf", "creator"], ["källänk", "sourceUrl"], ["licens", "license"], ["kontrolldatum", "rightsCheckedOn"], ["bildtext", "caption"], ["användning", "usedIn"], ["bearbetning", "modification"], ["rättighetsklarering", "usageCleared"], ["licensunderlag", "licenseEvidence"]] as const) {
    it(`fångar saknad obligatorisk metadata: ${name}`, () => {
      const p = validPhoto() as Record<string, unknown>;
      delete p[field];
      expect(validateContent(withPhoto(p), files(okSizes)).errors.length).toBeGreaterThan(0);
    });
  }
  it("kräver att alla fyra användningsklareringar är uttryckligen sanna", () => {
    const p = validPhoto({ usageCleared: { webPublishing: true, offlinePackage: true, modification: true, publicRepoStorage: false } });
    expect(validateContent(withPhoto(p), files(okSizes)).errors.length).toBeGreaterThan(0);
  });
  it("kräver alternativtext, men tom alternativtext för dekorativa bilder", () => {
    expect(validateContent(withPhoto(validPhoto({ alt: "" })), files(okSizes)).errors.some((e) => e.includes("Alternativtext"))).toBe(true);
    expect(validateContent(withPhoto(validPhoto({ decorative: true, alt: "något" })), files(okSizes)).errors.some((e) => e.includes("Dekorativ"))).toBe(true);
    const dec = withPhoto(validPhoto({ decorative: true, alt: "" }));
    (dec.home as { startImages: string[] }).startImages = []; // dekorativa bilder får inte slumpas som startbild (se egen kontroll)
    expect(validateContent(dec, files(okSizes)).errors).toEqual([]);
  });
  it("avvisar externa bildlänkar och ogiltiga sökvägar", () => {
    const p = validPhoto({ variants: [{ path: "https://images.example.com/x.webp", width: 10, height: 10, bytes: 10, format: "webp", crop: "default" }] });
    expect(validateContent(withPhoto(p), files(okSizes)).errors.length).toBeGreaterThan(0);
  });
  it("avvisar kontrolldatum i framtiden", () => {
    expect(validateContent(withPhoto(validPhoto({ rightsCheckedOn: "2999-01-01" })), files(okSizes)).errors.some((e) => e.includes("framtiden"))).toBe(true);
  });
  it("fångar okänd bild på en bildplats och bild som inte används där usedIn säger", () => {
    const raw = loadRawWithoutImages();
    (raw.home as { hero: { imageId: string | null } }).hero.imageId = "finns-inte";
    expect(validateContent(raw, files({})).errors.some((e) => e.includes("okänd bild"))).toBe(true);
    const r2 = withPhoto(validPhoto({ usedIn: ["t01-k01"] }));
    expect(validateContent(r2, files(okSizes)).errors.some((e) => e.includes("saknar det i usedIn") || e.includes("används inte där"))).toBe(true);
  });
  it("fångar bild i registret som ingen plats använder", () => {
    const raw = loadRawWithoutImages();
    raw.images = [validPhoto()];
    expect(validateContent(raw, files(okSizes)).errors.some((e) => e.includes("används inte där"))).toBe(true);
  });
});

describe("offlinelista och bildpaket", () => {
  it("hittar bildfiler som saknas i offlinelistan", () => {
    const photos = [validPhoto() as unknown as Photo];
    const manifest = { files: [{ url: "/images/testbild/testbild-640.webp", size: 40_000 }] };
    expect(missingFromManifest(photos, manifest)).toEqual(["/images/testbild/testbild-1280.webp"]);
    const full = { files: [...manifest.files, { url: "/images/testbild/testbild-1280.webp", size: 120_000 }, { url: "/index.html", size: 1 }] };
    expect(missingFromManifest(photos, full)).toEqual([]);
    expect(imageStats(full)).toEqual({ count: 2, bytes: 160_000 });
  });
});

describe("bildoptimering (pipeline)", () => {
  it("skapar WebP-varianter, mäter dem och respekterar storleksgränsen", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "img-"));
    const src = path.join(dir, "kamera.jpg");
    // Syntetisk testbild (inte ett fotografi): brusig gradient så att komprimering är realistisk.
    const raw = Buffer.alloc(3000 * 2000 * 3);
    for (let y = 0; y < 2000; y++)
      for (let x = 0; x < 3000; x++) {
        const i = (y * 3000 + x) * 3;
        raw[i] = (x / 3000) * 255;
        raw[i + 1] = (y / 2000) * 255;
        raw[i + 2] = ((x + y) / 5000) * 255;
      }
    await sharp(raw, { raw: { width: 3000, height: 2000, channels: 3 } }).jpeg().toFile(src);
    const out = path.join(dir, "public");
    const res = await optimizeImage({ input: src, id: "syntet", publicDir: out, widths: [480, 960, 1440], quality: 60 });
    expect(res.variants.map((v) => v.width)).toEqual([480, 960, 1440]);
    for (const v of res.variants) {
      expect(fs.statSync(path.join(out, v.path)).size).toBe(v.bytes);
      expect(v.height).toBe(Math.round((v.width * 2000) / 3000));
      expect(v.format).toBe("webp");
    }
    expect(res.variants.at(-1)!.bytes).toBeLessThanOrEqual(250 * 1024);
    const withMobile = await optimizeImage({ input: src, id: "syntet2", publicDir: out, widths: [480], mobile: true, focus: { x: 0.2, y: 0.5 } });
    const m = withMobile.variants.filter((v) => v.crop === "mobile");
    expect(m.length).toBeGreaterThan(0);
    expect(m[0].height / m[0].width).toBeCloseTo(0.75, 2);
    const pc = await optimizeImage({ input: src, id: "syntet3", publicDir: out, widths: [480], preCrop: { left: 0.1, right: 0.1, bottom: 0.2 } });
    expect(pc.source.width).toBe(2400);
    expect(pc.source.height).toBe(1600);
    expect(fs.existsSync(path.join(out, "images/syntet"))).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("bildkomponenter", () => {
  it("visar fotografi med fasta mått, bildtext, kreditering, licens- och källänk", async () => {
    const { PhotoSlot } = await import("@/components/Photo");
    state.photos = [validPhoto({ requiredCredit: "Foto: Testperson / Testplattform" }) as unknown as Photo];
    render(<PhotoSlot role="figure" slotId="s" imageId="testbild" brief="x" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("width", "1280");
    expect(img).toHaveAttribute("height", "853");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("alt", "En beskrivande alternativtext för testbilden.");
    expect(img.getAttribute("srcset")).toContain("640w");
    expect(img).toHaveStyle({ objectPosition: "40% 60%" });
    expect(screen.getByText("En testbild.")).toBeInTheDocument();
    // Bildtexten är bara en kort beskrivning: inga länkar, ID:n eller attribution.
    const fig = screen.getByRole("figure");
    expect(fig.querySelectorAll("a")).toHaveLength(0);
    expect(fig).not.toHaveTextContent(/Foto:|Testlicens|Originalet/);
  });
  it("rättighetsavsnittet har fotograf · källa · licens med länkar, och krediteringen finns kvar", async () => {
    const { PhotoRights } = await import("@/components/Photo");
    const p = validPhoto({ requiredCredit: "Foto: Testperson / Testplattform" }) as unknown as Photo;
    render(<PhotoRights photos={[p]} />);
    const li = screen.getByTestId("rights-testbild");
    expect(li).toHaveTextContent(p.creator);
    expect(li).toHaveTextContent(/·.*·/);
    expect(screen.getByRole("link", { name: "Testlicens" })).toHaveAttribute("href", "https://example.org/licens");
    expect(screen.getByRole("link", { name: "Källa" }).getAttribute("href")).toBe(p.sourceUrl);
    expect(screen.getByRole("heading", { name: "Bilder och rättigheter" })).toBeInTheDocument();
  });
  it("alla fotografier i registret: kreditkravet uppfylls av fotograf, licensnamn och länkar i rättighetsavsnittet", async () => {
    const { PhotoRights } = await import("@/components/Photo");
    const { default: images } = await import("@/content/images.json");
    for (const raw of images as unknown as Photo[]) {
      const { container, unmount } = render(<PhotoRights photos={[raw]} />);
      const text = container.textContent ?? "";
      expect(text, raw.id).toContain(raw.creator);
      expect(text, raw.id).toContain(raw.license.name);
      const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
      expect(hrefs, raw.id).toEqual(expect.arrayContaining([raw.sourceUrl, raw.license.url]));
      if (raw.requiredCredit) {
        // ”Foto: X, LICENS, via Wikimedia Commons”: alla delar finns i avsnittet
        expect(raw.requiredCredit).toContain(raw.license.name);
        expect(text, raw.id).toContain("Wikimedia Commons");
      }
      unmount();
    }
  });
  it("prioriterad bild laddas direkt; dekorativ bild har tom alt", async () => {
    const { PhotoSlot } = await import("@/components/Photo");
    state.photos = [validPhoto({ decorative: true, alt: "" }) as unknown as Photo];
    const { container } = render(<PhotoSlot role="hero" priority slotId="s" imageId="testbild" brief="x" />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("loading", "eager");
    expect(img).toHaveAttribute("fetchpriority", "high");
    expect(img).toHaveAttribute("alt", "");
  });
  it("reservyta utan synlig produktionstext", async () => {
    const { PhotoSlot } = await import("@/components/Photo");
    state.photos = [];
    render(<PhotoSlot role="hero" slotId="min-plats" imageId={null} brief="Ett lugnt landskap." />);
    expect(screen.getByTestId("photo-placeholder")).toHaveAttribute("data-slot", "min-plats");
    expect(screen.queryByText(/Fotografi väljs/)).toBeNull();
    expect(screen.getByText("Ett lugnt landskap.")).toHaveClass("sr-only"); // motivet finns bara som dold text
    expect(screen.queryByRole("img")).toBeNull();
  });
  it("mobilbeskärning ger egen <source> för smala skärmar", async () => {
    const { PhotoSlot } = await import("@/components/Photo");
    const p = validPhoto();
    (p.variants as unknown[]).push({ path: "/images/testbild/testbild-m480.webp", width: 480, height: 600, bytes: 30_000, format: "webp", crop: "mobile" });
    state.photos = [p as unknown as Photo];
    const { container } = render(<PhotoSlot role="hero" slotId="s" imageId="testbild" brief="x" />);
    const src = container.querySelector('source[media="(max-width: 639px)"]');
    expect(src?.getAttribute("srcset")).toContain("testbild-m480.webp 480w");
  });
});
