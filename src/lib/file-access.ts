import fs from "node:fs";
import path from "node:path";
import type { FileAccess } from "./content-validate";

/** Läser filstorlekar under public/ (för kontroll av lokala bildfiler). */
export function publicFiles(root = process.cwd()): FileAccess {
  return {
    size(publicPath) {
      const full = path.join(root, "public", publicPath);
      try {
        const st = fs.statSync(full);
        return st.isFile() ? st.size : undefined;
      } catch {
        return undefined;
      }
    },
  };
}
