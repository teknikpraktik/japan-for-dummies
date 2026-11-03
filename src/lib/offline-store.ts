"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  checkReady,
  downloadOffline,
  DownloadError,
  fetchManifest,
  offlineSupported,
  readMeta,
  removeOffline,
  type DownloadProgress,
  type OfflineMeta,
} from "./offline";

/**
 * Gemensamt tillstånd för offlinenedladdningen. Sidan Min utbildning
 * visar statusen; all status och alla uppdateringar visas bara där, aldrig i sidhuvudet. ”Klar” betyder alltid att nedladdningen är verifierad (alla filer finns).
 */
export interface PackageInfo {
  bytes: number;
  files: number;
  imageFiles?: number;
  imageBytes?: number;
}
export type OfflineView =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "idle"; hadBefore: boolean; info?: PackageInfo }
  | { kind: "downloading"; progress: DownloadProgress }
  | { kind: "ready"; meta: OfflineMeta; updateAvailable: boolean }
  | { kind: "error"; message: string; errorKind: string; info?: PackageInfo };

let view: OfflineView = { kind: "loading" };
let initialized = false;
let abort: AbortController | null = null;
const listeners = new Set<() => void>();
const set = (v: OfflineView) => {
  view = v;
  listeners.forEach((l) => l());
};

async function loadInfo(): Promise<PackageInfo | undefined> {
  try {
    if (!navigator.onLine) return undefined;
    const m = await fetchManifest();
    return { bytes: m.totalBytes, files: m.files.length, imageFiles: m.imageFiles, imageBytes: m.imageBytes };
  } catch {
    return undefined;
  }
}

export const offlineStore = {
  /** Läser nuvarande status en gång per sidladdning. */
  async init() {
    if (initialized) return;
    initialized = true;
    if (!offlineSupported() || process.env.NODE_ENV !== "production") {
      set({ kind: offlineSupported() ? "idle" : "unsupported", hadBefore: false });
      return;
    }
    const meta = readMeta();
    if (meta && (await checkReady(meta))) {
      let updateAvailable = false;
      try {
        if (navigator.onLine) updateAvailable = (await fetchManifest()).buildId !== meta.buildId;
      } catch {
        /* ingen koll möjlig just nu */
      }
      set({ kind: "ready", meta, updateAvailable });
    } else {
      set({ kind: "idle", hadBefore: Boolean(meta) });
      const info = await loadInfo();
      if (info && view.kind === "idle") set({ ...view, info });
    }
  },
  async start() {
    const prevInfo = view.kind === "idle" || view.kind === "error" ? view.info : undefined;
    const ctl = new AbortController();
    abort = ctl;
    set({ kind: "downloading", progress: { phase: "preparing", done: 0, total: 0, bytesDone: 0, bytesTotal: 0 } });
    try {
      const meta = await downloadOffline((progress) => set({ kind: "downloading", progress }), ctl.signal);
      set({ kind: "ready", meta, updateAvailable: false });
    } catch (e) {
      const err = e instanceof DownloadError ? e : new DownloadError("interrupted", "Något gick fel under nedladdningen.");
      set({ kind: "error", message: err.message, errorKind: err.kind, info: prevInfo });
    }
  },
  cancel() {
    abort?.abort();
  },
  async remove() {
    await removeOffline();
    set({ kind: "idle", hadBefore: false });
    const info = await loadInfo();
    if (info && view.kind === "idle") set({ ...view, info });
  },
};

export function useOfflineStatus(): OfflineView {
  useEffect(() => {
    void offlineStore.init();
  }, []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => view,
    () => ({ kind: "loading" }) as OfflineView,
  );
}
