import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "src", "content");

/** Sätter imageId på en bildplats (home-hero, kapitlets hero eller ett photo-block) och uppdaterar bildens usedIn. */
export function linkPhotoToSlot(imageId: string, slotId: string): string {
  const files = [path.join(root, "home.json"), ...fs.readdirSync(path.join(root, "chapters")).map((f) => path.join(root, "chapters", f))];
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(f, "utf8"));
    let owner: string | undefined;
    const isHome = path.basename(f) === "home.json";
    if (data.hero?.slotId === slotId) {
      data.hero.imageId = imageId;
      owner = isHome ? "home" : data.id;
    }
    for (const sec of data.sections ?? []) for (const b of sec.blocks) if (b.type === "photo" && b.slotId === slotId) { b.imageId = imageId; owner = data.id; }
    if (!owner) continue;
    fs.writeFileSync(f, JSON.stringify(data, null, 2) + "\n");
    const regPath = path.join(root, "images.json");
    const reg = JSON.parse(fs.readFileSync(regPath, "utf8")) as { id: string; usedIn: string[] }[];
    const p = reg.find((x) => x.id === imageId);
    if (!p) throw new Error(`Bilden ${imageId} finns inte i registret`);
    p.usedIn = p.usedIn.filter((u) => u !== "pending");
    if (!p.usedIn.includes(owner)) p.usedIn.push(owner);
    fs.writeFileSync(regPath, JSON.stringify(reg, null, 2) + "\n");
    return owner;
  }
  throw new Error(`Bildplatsen ${slotId} hittades inte`);
}
