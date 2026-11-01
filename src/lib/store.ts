"use client";

import { useSyncExternalStore } from "react";
import {
  clearDraft as clearDraftFn,
  emptyState,
  markStarted as markStartedFn,
  mergeStates,
  parseStoredState,
  recordQuizResult as recordFn,
  replaceState,
  setDraft as setDraftFn,
  toggleFavorite as toggleFn,
  type ProgressState,
  type QuizDraft,
} from "./progress";
import { CORRUPT_BACKUP_KEY, createSafeStorage, STORAGE_KEY, type SafeStorage } from "./storage";

/**
 * ok          – allt sparas lokalt
 * unavailable – webbläsaren blockerar lagring: framsteg finns bara tills sidan stängs
 * write-failed – lagring finns men det gick inte att skriva (t.ex. fullt)
 * recovered   – sparad data var skadad; en säkerhetskopia av texten sparades och vi började om
 */
export type StorageStatus = "ok" | "unavailable" | "write-failed" | "recovered";

export interface Snapshot {
  hydrated: boolean;
  state: ProgressState;
  status: StorageStatus;
}

const SERVER_SNAPSHOT: Snapshot = { hydrated: false, state: emptyState(), status: "ok" };

let storage: SafeStorage | null = null;
let snapshot: Snapshot = SERVER_SNAPSHOT;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function load(): Snapshot {
  storage = createSafeStorage();
  if (!storage.available) return { hydrated: true, state: emptyState(), status: "unavailable" };
  const raw = storage.get(STORAGE_KEY);
  const parsed = parseStoredState(raw);
  if (parsed === "empty") return { hydrated: true, state: emptyState(), status: "ok" };
  if (parsed === null) {
    if (raw) storage.set(CORRUPT_BACKUP_KEY, raw.slice(0, 100_000));
    storage.remove(STORAGE_KEY);
    return { hydrated: true, state: emptyState(), status: "recovered" };
  }
  return { hydrated: true, state: parsed, status: "ok" };
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  snapshot = load();
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      const fresh = load();
      snapshot = { ...fresh, status: snapshot.status === "recovered" ? "recovered" : fresh.status };
      emit();
    }
  });
}

function commit(next: ProgressState) {
  if (next === snapshot.state) return;
  let status = snapshot.status;
  if (storage?.available) {
    const ok = storage.set(STORAGE_KEY, JSON.stringify(next));
    status = ok ? (status === "write-failed" ? "ok" : status) : "write-failed";
  }
  snapshot = { hydrated: true, state: next, status };
  emit();
}

function update(fn: (s: ProgressState) => ProgressState) {
  ensureLoaded();
  commit(fn(snapshot.state));
}

/* ---------- Offentligt API ---------- */
export const progressStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): Snapshot {
    ensureLoaded();
    return snapshot;
  },
  getServerSnapshot(): Snapshot {
    return SERVER_SNAPSHOT;
  },
  markStarted: (id: string, v: number) => update((s) => markStartedFn(s, id, v)),
  recordQuizResult: (id: string, v: number, score: number) => update((s) => recordFn(s, id, v, score)),
  finishQuiz: (id: string, v: number, score: number, draft: QuizDraft) => update((s) => setDraftFn(recordFn(s, id, v, score), id, draft)),
  toggleFavorite: (id: string) => update((s) => toggleFn(s, id)),
  setDraft: (id: string, d: QuizDraft) => update((s) => setDraftFn(s, id, d)),
  clearDraft: (id: string) => update((s) => clearDraftFn(s, id)),
  setLastExport: (iso: string) => update((s) => ({ ...s, lastExportAt: iso })),
  mergeIn: (incoming: Pick<ProgressState, "chapters" | "favorites">) => update((s) => mergeStates(s, incoming)),
  replaceWith: (incoming: Pick<ProgressState, "chapters" | "favorites">) => update((s) => replaceState(s, incoming)),
  dismissRecovered: () => {
    if (snapshot.status === "recovered") {
      snapshot = { ...snapshot, status: "ok" };
      emit();
    }
  },
  /** Endast för tester. */
  __reset() {
    loaded = false;
    storage = null;
    snapshot = SERVER_SNAPSHOT;
    listeners.clear();
  },
};

export function useProgress(): Snapshot {
  return useSyncExternalStore(progressStore.subscribe, progressStore.getSnapshot, progressStore.getServerSnapshot);
}
