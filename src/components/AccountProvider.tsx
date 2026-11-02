"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { ACCOUNTS_ENABLED } from "@/lib/features";
import { acctPrefix, LAST_ACCOUNT_KEY } from "@/lib/storage";
import { progressStore } from "@/lib/store";
import { clearAccountLocalData, pendingCount, flush, startSync, stopSync } from "@/lib/sync";

export interface Me {
  id: string;
  displayName: string;
  role: "student" | "teacher";
  groupName: string;
  twoFactorEnabled: boolean;
  adminAccess: boolean;
  enrollmentRequired: boolean;
}

export type AccountStatus = "loading" | "anonymous" | "ready" | "offline";

interface AccountCtx {
  status: AccountStatus;
  user: Me | null;
  /** Offline och inloggningen kan inte bekräftas av servern. Visas aldrig som inloggad. */
  unverified: boolean;
  /** Eleven har uttryckligen valt att spara personliga framsteg på den här (egna) enheten. */
  persist: boolean;
  refresh: () => Promise<void>;
  setPersist: (on: boolean) => void;
  logout: (opts?: { force?: boolean }) => Promise<{ ok: boolean; reason?: "pending" | "offline" }>;
}

const Ctx = createContext<AccountCtx>({ status: "loading", user: null, unverified: false, persist: false, refresh: async () => {}, setPersist: () => {}, logout: async () => ({ ok: false }) });
export const useAccount = () => useContext(Ctx);

const persistFlagKey = (id: string) => `${acctPrefix(id)}persist`;

function readPersist(id: string): boolean {
  try {
    return window.localStorage.getItem(persistFlagKey(id)) === "1";
  } catch {
    return false;
  }
}

/** Tar bort nycklar som tillhörde inloggade konton (japanresan:v2:*). Gästframstegen (japanresan:v1:state) rörs inte. */
function removeLegacyAccountData() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("japanresan:v2:")) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
    const sk: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith("japanresan:v2:")) sk.push(k);
    }
    sk.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {
    /* lagring otillgänglig: inget att rensa */
  }
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AccountStatus>(ACCOUNTS_ENABLED ? "loading" : "anonymous");
  const [user, setUser] = useState<Me | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [persist, setPersistState] = useState(false);
  const userRef = useRef<Me | null>(null);

  const apply = useCallback((me: Me | null, isUnverified: boolean) => {
    userRef.current = me;
    setUser(me);
    setUnverified(isUnverified);
    if (!me) {
      stopSync();
      progressStore.setScope({ kind: "guest" });
      setPersistState(false);
      setStatus(isUnverified ? "offline" : "anonymous");
      return;
    }
    const p = readPersist(me.id);
    setPersistState(p);
    if (me.role === "student") {
      progressStore.setScope({ kind: "account", userId: me.id, persist: p, sync: !isUnverified });
      if (isUnverified) stopSync();
      else startSync(me.id, p);
    } else {
      // Lärare: inga personliga framsteg centralt och inget sparas kvar på enheten.
      stopSync();
      progressStore.setScope({ kind: "account", userId: me.id, persist: false, sync: false });
    }
    setStatus(isUnverified ? "offline" : "ready");
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me/", { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) throw new Error("status");
      const data = (await res.json()) as { user: Me | null };
      apply(data.user, false);
    } catch {
      // Servern nåddes inte (offline). Visa en lokal identitet endast om eleven själv valt att spara på enheten,
      // och markera tydligt att inloggningen inte är bekräftad.
      try {
        const last = window.localStorage.getItem(LAST_ACCOUNT_KEY);
        if (last) {
          const m = JSON.parse(last) as { id: string; displayName: string };
          apply({ id: m.id, displayName: m.displayName, role: "student", groupName: "", twoFactorEnabled: false, adminAccess: false, enrollmentRequired: false }, true);
          return;
        }
      } catch {
        /* ignorera */
      }
      apply(null, true);
    }
  }, [apply]);

  useEffect(() => {
    if (!ACCOUNTS_ENABLED) {
      // Kontofri tjänst: inga anrop om session eller synk. Rensa kvarglömda kontokopplade uppgifter från
      // tidigare versioner så att de aldrig blandas med gästframstegen.
      removeLegacyAccountData();
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- datahämtning vid montering
    void refresh();
    const onFocus = () => void refresh();
    const onOnline = () => void refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, [refresh]);

  const setPersist = useCallback((on: boolean) => {
    const me = userRef.current;
    if (!me || me.role !== "student") return;
    try {
      if (on) {
        window.localStorage.setItem(persistFlagKey(me.id), "1");
        window.localStorage.setItem(LAST_ACCOUNT_KEY, JSON.stringify({ id: me.id, displayName: me.displayName }));
      } else {
        window.localStorage.removeItem(persistFlagKey(me.id));
        window.localStorage.removeItem(LAST_ACCOUNT_KEY);
      }
    } catch {
      return;
    }
    setPersistState(on);
    progressStore.setScope({ kind: "account", userId: me.id, persist: on, sync: true });
    startSync(me.id, on);
  }, []);

  const logout = useCallback(async (opts?: { force?: boolean }) => {
    const me = userRef.current;
    if (!me) return { ok: true };
    if (!navigator.onLine) return { ok: false, reason: "offline" as const };
    if (me.role === "student" && !opts?.force) {
      await flush();
      if (pendingCount() > 0) return { ok: false, reason: "pending" as const };
    }
    try {
      await authClient.signOut();
    } catch {
      return { ok: false, reason: "offline" as const };
    }
    clearAccountLocalData(me.id);
    apply(null, false);
    return { ok: true };
  }, [apply]);

  const value = useMemo(() => ({ status, user, unverified, persist, refresh, setPersist, logout }), [status, user, unverified, persist, refresh, setPersist, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
