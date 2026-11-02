/** Klientlogik för ”Gör utbildningen tillgänglig offline”. */

export const OFFLINE_META_KEY = "japanresan:v1:offline";
export const OFFLINE_CACHE_PREFIX = "japanresan-offline-";
const CONCURRENCY = 4;

export interface ManifestFile {
  url: string;
  size: number;
}
export interface OfflineManifest {
  buildId: string;
  totalBytes: number;
  /** Antal och storlek för bildfiler i paketet (ingår i totalen). */
  imageFiles?: number;
  imageBytes?: number;
  files: ManifestFile[];
}
export interface OfflineMeta {
  buildId: string;
  readyAt: string;
  bytes: number;
  fileCount: number;
  imageFiles?: number;
  imageBytes?: number;
}

export type DownloadErrorKind = "unsupported" | "insufficient-storage" | "interrupted" | "incomplete" | "cancelled";
export class DownloadError extends Error {
  constructor(public kind: DownloadErrorKind, message: string) {
    super(message);
  }
}

export interface DownloadProgress {
  phase: "preparing" | "downloading" | "verifying";
  done: number;
  total: number;
  bytesDone: number;
  bytesTotal: number;
}

export function offlineSupported(): boolean {
  return typeof window !== "undefined" && "caches" in window && "serviceWorker" in navigator;
}

export function cacheNameFor(buildId: string): string {
  return OFFLINE_CACHE_PREFIX + buildId;
}

export function readMeta(): OfflineMeta | null {
  try {
    const raw = window.localStorage.getItem(OFFLINE_META_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw) as OfflineMeta;
    return typeof m.buildId === "string" && typeof m.readyAt === "string" ? m : null;
  } catch {
    return null;
  }
}
function writeMeta(m: OfflineMeta | null) {
  try {
    if (m) window.localStorage.setItem(OFFLINE_META_KEY, JSON.stringify(m));
    else window.localStorage.removeItem(OFFLINE_META_KEY);
  } catch {
    /* webbläsaren blockerar lagring – offlinecachen fungerar ändå */
  }
}

export async function fetchManifest(): Promise<OfflineManifest> {
  const res = await fetch("/offline-manifest.json", { cache: "no-store" });
  if (!res.ok) throw new DownloadError("interrupted", "Kunde inte hämta listan över filer.");
  const m = (await res.json()) as OfflineManifest;
  if (!m || typeof m.buildId !== "string" || !Array.isArray(m.files)) throw new DownloadError("interrupted", "Listan över filer är ogiltig.");
  return m;
}

/** Kontrollerar att varje fil i manifestet faktiskt finns i cachen. */
export async function verifyCache(manifest: OfflineManifest): Promise<{ ok: boolean; missing: number }> {
  if (!(await caches.has(cacheNameFor(manifest.buildId)))) return { ok: false, missing: manifest.files.length };
  const cache = await caches.open(cacheNameFor(manifest.buildId));
  let missing = 0;
  for (const f of manifest.files) if (!(await cache.match(f.url, { ignoreVary: true }))) missing++;
  return { ok: missing === 0, missing };
}

function isQuotaError(e: unknown): boolean {
  return e instanceof DOMException && (e.name === "QuotaExceededError" || e.code === 22);
}

export async function downloadOffline(onProgress: (p: DownloadProgress) => void, signal?: AbortSignal): Promise<OfflineMeta> {
  if (!offlineSupported()) throw new DownloadError("unsupported", "Webbläsaren stöder inte offlineläge.");
  onProgress({ phase: "preparing", done: 0, total: 0, bytesDone: 0, bytesTotal: 0 });
  const manifest = await fetchManifest();

  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.quota !== undefined && est.usage !== undefined && est.quota - est.usage < manifest.totalBytes * 1.2) {
      throw new DownloadError("insufficient-storage", "Det finns inte tillräckligt med lagringsutrymme på enheten.");
    }
  } catch (e) {
    if (e instanceof DownloadError) throw e;
  }

  const cache = await caches.open(cacheNameFor(manifest.buildId));
  const total = manifest.files.length;
  let done = 0;
  let bytesDone = 0;
  const report = (phase: DownloadProgress["phase"] = "downloading") => onProgress({ phase, done, total, bytesDone, bytesTotal: manifest.totalBytes });
  report();

  const queue = [...manifest.files];
  async function worker() {
    for (;;) {
      if (signal?.aborted) throw new DownloadError("cancelled", "Nedladdningen avbröts.");
      const f = queue.shift();
      if (!f) return;
      if (!(await cache.match(f.url, { ignoreVary: true }))) {
        let res: Response;
        try {
          res = await fetch(f.url, { cache: "reload", signal });
        } catch {
          if (signal?.aborted) throw new DownloadError("cancelled", "Nedladdningen avbröts.");
          throw new DownloadError("interrupted", "Nedladdningen avbröts, troligen på grund av nätverket. Det som redan hämtats är sparat, så du kan fortsätta.");
        }
        if (!res.ok) throw new DownloadError("interrupted", `Servern svarade ${res.status} för ${f.url}.`);
        // Personliga svar får aldrig hamna i den delade offlinecachen.
        if (res.headers.has("set-cookie") || /\b(private|no-store)\b/i.test(res.headers.get("cache-control") ?? "")) {
          throw new DownloadError("incomplete", `Svaret för ${f.url} är personligt eller ocachebart och sparas inte offline.`);
        }
        try {
          await cache.put(f.url, res);
        } catch (e) {
          if (isQuotaError(e)) throw new DownloadError("insufficient-storage", "Lagringsutrymmet tog slut under nedladdningen.");
          throw new DownloadError("interrupted", "Det gick inte att spara en fil i cachen.");
        }
      }
      done++;
      bytesDone += f.size;
      report();
    }
  }

  const results = await Promise.allSettled(Array.from({ length: CONCURRENCY }, worker));
  const failure = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failure) {
    queue.length = 0;
    throw failure.reason instanceof DownloadError ? failure.reason : new DownloadError("interrupted", "Nedladdningen misslyckades.");
  }

  report("verifying");
  const check = await verifyCache(manifest);
  if (!check.ok) throw new DownloadError("incomplete", `${check.missing} filer saknas i cachen. Försök igen.`);

  // Först nu är utbildningen offlineklar. Ta bort cachar från äldre versioner.
  for (const name of await caches.keys()) if (name.startsWith(OFFLINE_CACHE_PREFIX) && name !== cacheNameFor(manifest.buildId)) await caches.delete(name);
  const meta: OfflineMeta = { buildId: manifest.buildId, readyAt: new Date().toISOString(), bytes: manifest.totalBytes, fileCount: total, imageFiles: manifest.imageFiles, imageBytes: manifest.imageBytes };
  writeMeta(meta);
  return meta;
}

export async function removeOffline(): Promise<void> {
  for (const name of await caches.keys()) if (name.startsWith(OFFLINE_CACHE_PREFIX)) await caches.delete(name);
  writeMeta(null);
}

/** Bekräftar att tidigare nedladdning fortfarande finns kvar (webbläsaren kan ha rensat den). */
export async function checkReady(meta: OfflineMeta): Promise<boolean> {
  try {
    return await caches.has(cacheNameFor(meta.buildId));
  } catch {
    return false;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} kB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
