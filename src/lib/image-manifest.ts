import type { Photo } from "./schema";

interface ManifestLike {
  files: { url: string; size: number }[];
}

/** Bildfiler i registret som saknas i offlinelistan (ska vara tom). */
export function missingFromManifest(photos: Photo[], manifest: ManifestLike): string[] {
  const have = new Set(manifest.files.map((f) => f.url));
  return photos.flatMap((p) => p.variants.map((v) => v.path)).filter((p) => !have.has(p));
}

/** Antal och storlek för bildfiler i offlinelistan. */
export function imageStats(manifest: ManifestLike): { count: number; bytes: number } {
  const imgs = manifest.files.filter((f) => f.url.startsWith("/images/"));
  return { count: imgs.length, bytes: imgs.reduce((n, f) => n + f.size, 0) };
}
