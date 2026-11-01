"use client";

import { useSyncExternalStore } from "react";
import {
  clearDraft as clearDraftFn,
  emptyState,
  markStarted as markStartedFn,
  mergeServerRows,
  mergeStates,
  parseStoredState,
  recordQuizResult as recordFn,
  replaceState,
  setDraft as setDraftFn,
  toggleFavorite as toggleFn,
  type ProgressState,
  type QuizDraft,
  type ServerProgressRow,
} from "./progress";
import { acctPrefix, CORRUPT_BACKUP_KEY, createSafeStorage, STORAGE_KEY, type SafeStorage } from "./storage";
import { isPassed, scoreQuiz } from "./scoring";
import type { QuizQuestion } from "./schema";

/**
 * ok          – allt sparas lokalt
 * unavailable – webbläsaren blockerar lagring: framsteg finns bara tills sidan stängs
 * write-failed – lagring finns men det gick inte att skriva (t.ex. fullt)
 * recovered   – sparad data var skadad; en säkerhetskopia av texten sparades och vi började om
 */
export type StorageStatus = "ok" | "unavailable" | "write-failed" | "recovered";

/**
 * Lagringsomfång. Gäst = äldre, anonyma lokala framsteg (som före inloggning). Konto = isolerat per konto-ID;
 * som standard i sessionStorage (försvinner när fliken stängs), och i localStorage först om användaren
 * uttryckligen valt att spara på sin egen enhet (persist).
 */
export type Scope = { kind: "guest" } | { kind: "account"; userId: string; persist: boolean; sync: boolean };

export interface Snapshot {
  hydrated: boolean;
  state: ProgressState;
  status: StorageStatus;
  scope: Scope;
}

/** Händelser som skickas vidare till synkmodulen (centralt sparas bara status, aldrig svar eller försökshistorik). */
export type SyncEvent =
  | { type: "started"; chapterId: string; contentVersion: number }
  | { type: "completed"; chapterId: string; contentVersion: number; answers: Record<string, string> };

const GUEST: Scope = { kind: "guest" };
const SERVER_SNAPSHOT: Snapshot = { hydrated: false, state: emptyState(), status: "ok", scope: GUEST };

let scope: Scope = GUEST;
let storage: SafeStorage | null = null;
let snapshot: Snapshot = SERVER_SNAPSHOT;
let loaded = false;
let syncSink: ((e: SyncEvent) => void) | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const stateKey = (s: Scope) => (s.kind === "guest" ? STORAGE_KEY : `${acctPrefix(s.userId)}state`);

function backing(s: Scope): SafeStorage {
  if (s.kind === "account" && !s.persist) return createSafeStorage(() => window.sessionStorage);
  return createSafeStorage(() => window.localStorage);
}

function load(): Snapshot {
  storage = backing(scope);
  if (!storage.available) return { hydrated: true, state: emptyState(), status: "unavailable", scope };
  const key = stateKey(scope);
  const raw = storage.get(key);
  const parsed = parseStoredState(raw);
  if (parsed === "empty") return { hydrated: true, state: emptyState(), status: "ok", scope };
  if (parsed === null) {
    if (raw) storage.set(CORRUPT_BACKUP_KEY + (scope.kind === "account" ? `:${scope.userId}` : ""), raw.slice(0, 100_000));
    storage.remove(key);
    return { hydrated: true, state: emptyState(), status: "recovered", scope };
  }
  return { hydrated: true, state: parsed, status: "ok", scope };
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  snapshot = load();
  window.addEventListener("storage", (e) => {
    if (e.key === stateKey(scope) || e.key === null) {
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
    const ok = storage.set(stateKey(scope), JSON.stringify(next));
    status = ok ? (status === "write-failed" ? "ok" : status) : "write-failed";
  }
  snapshot = { hydrated: true, state: next, status, scope };
  emit();
}

function update(fn: (s: ProgressState) => ProgressState) {
  ensureLoaded();
  commit(fn(snapshot.state));
}

const sameScope = (a: Scope, b: Scope) =>
  a.kind === b.kind && (a.kind === "guest" || (b.kind === "account" && a.userId === b.userId && a.persist === b.persist && a.sync === b.sync));

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
  /**
   * Byter lagringsomfång (gäst eller ett visst konto). Ett kontos data läses aldrig i ett annat kontos omfång.
   * Vid byte från persist=false till persist=true (eller tvärtom) flyttas tillståndet till rätt lagring.
   */
  setScope(next: Scope) {
    ensureLoaded();
    if (sameScope(scope, next)) return;
    const prev = scope;
    const carry = prev.kind === "account" && next.kind === "account" && prev.userId === next.userId ? snapshot.state : null;
    scope = next;
    snapshot = load();
    if (carry) {
      // Samma konto, ändrat sparval: flytta lokala framsteg till den nya lagringen och rensa den gamla.
      commit(snapshot.state === carry ? carry : mergeStates(snapshot.state, carry));
      if (prev.kind === "account") {
        const old = backing(prev);
        old.remove(stateKey(prev));
      }
    }
    emit();
  },
  currentScope: (): Scope => scope,
  setSyncSink(fn: ((e: SyncEvent) => void) | null) {
    syncSink = fn;
  },
  markStarted(id: string, v: number) {
    ensureLoaded();
    const before = snapshot.state;
    update((s) => markStartedFn(s, id, v));
    if (snapshot.state !== before) syncSink?.({ type: "started", chapterId: id, contentVersion: v });
  },
  recordQuizResult: (id: string, v: number, score: number) => update((s) => recordFn(s, id, v, score)),
  /** Sparar slutresultatet. Skickar status (och svaren, enbart för servern att kontrollera) till synkmodulen. */
  finishQuiz(id: string, v: number, score: number, draft: QuizDraft) {
    update((s) => setDraftFn(recordFn(s, id, v, score), id, draft));
    syncSink?.(isPassed(score) ? { type: "completed", chapterId: id, contentVersion: v, answers: draft.answers } : { type: "started", chapterId: id, contentVersion: v });
  },
  toggleFavorite: (id: string) => update((s) => toggleFn(s, id)),
  setDraft: (id: string, d: QuizDraft) => update((s) => setDraftFn(s, id, d)),
  clearDraft: (id: string) => update((s) => clearDraftFn(s, id)),
  setLastExport: (iso: string) => update((s) => ({ ...s, lastExportAt: iso })),
  mergeIn: (incoming: Pick<ProgressState, "chapters" | "favorites">) => update((s) => mergeStates(s, incoming)),
  replaceWith: (incoming: Pick<ProgressState, "chapters" | "favorites">) => update((s) => replaceState(s, incoming)),
  /** Slår in centralt sparad status (avklarat återgår aldrig). */
  mergeServer: (rows: ServerProgressRow[]) => update((s) => mergeServerRows(s, rows)),
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
    scope = GUEST;
    snapshot = SERVER_SNAPSHOT;
    syncSink = null;
    listeners.clear();
  },
};

export function useProgress(): Snapshot {
  return useSyncExternalStore(progressStore.subscribe, progressStore.getSnapshot, progressStore.getServerSnapshot);
}

/** Hjälpare för quizkomponenten: räkna poäng som tidigare. */
export function scoreFor(questions: QuizQuestion[], answers: Record<string, string>) {
  return scoreQuiz(questions, answers);
}
