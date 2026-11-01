/** Återanvänder en registrerad bild på ytterligare en bildplats:  npm run images:use -- <imageId> <slotId> */
import { linkPhotoToSlot } from "./slots-lib";
const [imageId, slotId] = process.argv.slice(2);
if (!imageId || !slotId) {
  console.error("Användning: npm run images:use -- <imageId> <slotId>");
  process.exit(1);
}
console.log(`Kopplade ${imageId} till ${slotId} (${linkPhotoToSlot(imageId, slotId)})`);
