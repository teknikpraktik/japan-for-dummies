import { z } from "zod";
import { STATE_VERSION, transferDataSchema, type ProgressState } from "./progress";

export const APP_ID = "japanresan-2027";
/** Max filstorlek vid import (byte). Verklig export är några kilobyte. */
export const MAX_IMPORT_BYTES = 256 * 1024;

export interface ExportFile {
  app: string;
  dataVersion: number;
  exportedAt: string;
  data: Pick<ProgressState, "chapters" | "favorites">;
}

export function buildExport(s: ProgressState, now = new Date()): ExportFile {
  return {
    app: APP_ID,
    dataVersion: STATE_VERSION,
    exportedAt: now.toISOString(),
    data: { chapters: s.chapters, favorites: s.favorites },
  };
}

export function exportFilename(now = new Date()): string {
  return `japanresan-framsteg-${now.toISOString().slice(0, 10)}.json`;
}

const envelope = z.object({
  app: z.literal(APP_ID, { error: "Filen kommer inte från Japanresan 2027." }),
  dataVersion: z.number().int(),
  exportedAt: z.string().max(40),
  data: z.unknown(),
});

export type ImportResult =
  | { ok: true; data: Pick<ProgressState, "chapters" | "favorites">; exportedAt: string }
  | { ok: false; error: string };

/** Kontrollerar storlek, struktur och dataversion. Ändrar ingenting. */
export function parseImport(text: string, sizeBytes: number = new Blob([text]).size): ImportResult {
  if (sizeBytes > MAX_IMPORT_BYTES) return { ok: false, error: `Filen är för stor (${Math.round(sizeBytes / 1024)} kB). Gränsen är ${MAX_IMPORT_BYTES / 1024} kB.` };
  if (sizeBytes === 0 || text.trim() === "") return { ok: false, error: "Filen är tom." };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "Filen är inte giltig JSON. Välj en fil som exporterats från Japanresan 2027." };
  }
  const env = envelope.safeParse(json);
  if (!env.success) return { ok: false, error: env.error.issues[0]?.message ?? "Filens struktur är fel." };
  if (env.data.dataVersion > STATE_VERSION) return { ok: false, error: "Filen kommer från en nyare version av appen. Uppdatera appen och försök igen." };
  if (env.data.dataVersion < 1) return { ok: false, error: "Filens dataversion stöds inte." };
  const data = transferDataSchema.safeParse(env.data.data);
  if (!data.success) return { ok: false, error: "Filens innehåll har fel format eller är skadat. Inget har ändrats." };
  return { ok: true, data: data.data, exportedAt: env.data.exportedAt };
}
