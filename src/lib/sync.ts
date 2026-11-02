"use client";

import { useSyncExternalStore } from "react";
import { acctPrefix, createSafeStorage, LAST_ACCOUNT_KEY, type SafeStorage } from "./storage";
import { progressStore, type SyncEvent } from "./store";
import type { ServerProgressRow } from "./progress";

/**
 * Synkning av en elevs framsteg mot servern. Köns poster är {startad | avklarad + svar}. Svaren skickas bara
 * för att servern ska kunna kontrollera resultatet och sparas aldrig centralt. Upprepade anrop är ofarliga
 * (servern är idempotent och avklarat återgår aldrig till påbörjat). Kön och lokala framsteg är isolerade per konto.
 *
 * Observera: framsteg som skapats offline är en pedagogisk bekvämlighet, inte ett manipulationssäkert betygsunderlag.
 */
export type SyncStatus = "idle" | "syncing" | "offline" | "error" | "expired";

export interface SyncSnapshot {
  status: SyncStatus;
  pending: number;
  lastSyncedAt: string | null;
  /** Begripliga meddelanden, t.ex. ändrade kapitelversioner. */
  notices: string[];
}

type QueuedOp = SyncEvent & { opId: string };

const SERVER: SyncSnapshot = { status: "idle", pending: 0, lastSyncedAt: null, notices: [] };
let snap: SyncSnapshot = SERVER;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (patch: Partial<SyncSnapshot>) => {
  snap = { ...snap, ...patch };
  emit();
};

let userId: string | null = null;
let persist = false;
let queue: QueuedOp[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let flushing = false;
let removeListeners: (() => void) | null = null;

const queueKey = () => `${acctPrefix(userId!)}queue`;
const store = (): SafeStorage => createSafeStorage(() => (persist ? window.localStorage : window.sessionStorage));

function saveQueue() {
  const s = store();
  if (queue.length) s.set(queueKey(), JSON.stringify(queue));
  else s.remove(queueKey());
  set({ pending: queue.length });
}

function loadQueue(): QueuedOp[] {
  try {
    const raw = store().get(queueKey());
    const arr = raw ? (JSON.parse(raw) as QueuedOp[]) : [];
    return Array.isArray(arr) ? arr.filter((o) => o && typeof o.opId === "string" && typeof o.chapterId === "string").slice(0, 200) : [];
  } catch {
    return [];
  }
}

function enqueue(ev: SyncEvent) {
  if (!userId) return;
  const op: QueuedOp = { ...ev, opId: crypto.randomUUID() };
  // En avklarad-post går före en startad-post för samma kapitel (och ersätter en äldre avklarad).
  queue = queue.filter((q) => !(q.chapterId === op.chapterId && (q.type === "started" || op.type === "completed")));
  queue.push(op);
  saveQueue();
  void flush();
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, { credentials: "same-origin", cache: "no-store", ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
}

export async function pull(): Promise<void> {
  if (!userId || !navigator.onLine) return;
  try {
    const res = await request("/api/framsteg/");
    if (res.status === 401) return void set({ status: "expired" });
    if (!res.ok) return;
    const data = (await res.json()) as { rows: ServerProgressRow[]; lastSyncedAt: string | null };
    progressStore.mergeServer(data.rows);
    set({ lastSyncedAt: data.lastSyncedAt });
  } catch {
    set({ status: "offline" });
  }
}

export async function flush(): Promise<void> {
  if (!userId || flushing) return;
  if (queue.length === 0) return void (snap.status === "offline" || snap.status === "error" ? set({ status: "idle" }) : undefined);
  if (!navigator.onLine) return void set({ status: "offline" });
  flushing = true;
  set({ status: "syncing" });
  const sent = [...queue];
  try {
    const res = await request("/api/framsteg/sync/", {
      method: "POST",
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      body: JSON.stringify({ ops: sent.map(({ opId: _id, ...op }) => op) }),
    });
    if (res.status === 401) {
      // Sessionen har gått ut, kontot är avaktiverat eller sessionen återkallad. Kön behålls tills användaren loggar in igen eller loggar ut.
      set({ status: "expired" });
      return;
    }
    if (res.status === 403) {
      set({ status: "error" });
      return;
    }
    if (!res.ok) {
      set({ status: "error" });
      return;
    }
    const data = (await res.json()) as { results: { chapterId: string; result: string }[]; rows: ServerProgressRow[]; lastSyncedAt: string | null };
    const done = new Set(sent.map((o) => o.opId));
    queue = queue.filter((o) => !done.has(o.opId));
    saveQueue();
    const notices: string[] = [];
    for (const r of data.results) if (r.result === "version-mismatch") notices.push(`Kapitlet ${r.chapterId} har uppdaterats sedan du gjorde testet. Gör testet igen för att uppdatera din status.`);
    progressStore.mergeServer(data.rows);
    set({ status: "idle", lastSyncedAt: data.lastSyncedAt, notices: notices.length ? Array.from(new Set([...snap.notices, ...notices])) : snap.notices });
  } catch {
    set({ status: "offline" });
  } finally {
    flushing = false;
  }
}

function attach() {
  const onOnline = () => void flush().then(pull);
  const onVisible = () => {
    if (document.visibilityState === "visible") void flush().then(pull);
  };
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  timer = setInterval(() => {
    if (queue.length) void flush();
  }, 30_000);
  removeListeners = () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
    if (timer) clearInterval(timer);
    timer = null;
  };
}

/** Startar synkning för en elev. Anropas igen med ändrat persist-val för att flytta kön till rätt lagring. */
export function startSync(id: string, persistLocally: boolean) {
  if (userId === id && persist === persistLocally) return;
  const carry = userId === id ? queue : null;
  const oldStore = userId === id ? store() : null;
  const oldKey = userId ? queueKey() : "";
  stopSync(false);
  userId = id;
  persist = persistLocally;
  queue = carry ?? loadQueue();
  if (oldStore && oldKey) oldStore.remove(oldKey);
  progressStore.setSyncSink(enqueue);
  snap = { ...snap, status: "idle", pending: queue.length };
  emit();
  attach();
  void pull().then(flush);
}

export function stopSync(resetSnapshot = true) {
  progressStore.setSyncSink(null);
  removeListeners?.();
  removeListeners = null;
  userId = null;
  queue = [];
  if (resetSnapshot) {
    snap = SERVER;
    emit();
  }
}

export const pendingCount = () => queue.length;
export const clearNotices = () => set({ notices: [] });

/** Tar bort ALLA personliga lokala data för ett konto (framsteg, utkast, kö, sparval) ur båda lagringarna. */
export function clearAccountLocalData(id: string) {
  for (const getter of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      const s = getter();
      const prefix = acctPrefix(id);
      for (let i = s.length - 1; i >= 0; i--) {
        const k = s.key(i);
        if (k && (k.startsWith(prefix) || k.startsWith(`japanresan:v1:corrupt-backup:${id}`))) s.removeItem(k);
      }
      if (s === window.localStorage) {
        const last = s.getItem(LAST_ACCOUNT_KEY);
        if (last && last.includes(id)) s.removeItem(LAST_ACCOUNT_KEY);
      }
    } catch {
      /* lagring blockerad: inget att rensa */
    }
  }
}

export function useSyncStatus(): SyncSnapshot {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snap,
    () => SERVER,
  );
}
