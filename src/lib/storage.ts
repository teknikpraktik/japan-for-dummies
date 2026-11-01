/** Säker åtkomst till localStorage. Kastar aldrig. */
export const STORAGE_KEY = "japanresan:v1:state";
export const CORRUPT_BACKUP_KEY = "japanresan:v1:corrupt-backup";

export interface SafeStorage {
  get(key: string): string | null;
  set(key: string, value: string): boolean;
  remove(key: string): void;
  readonly available: boolean;
}

export function createSafeStorage(getter: () => Storage = () => window.localStorage): SafeStorage {
  let backing: Storage | null = null;
  try {
    backing = getter();
    const probe = "japanresan:probe";
    backing.setItem(probe, "1");
    backing.removeItem(probe);
  } catch {
    backing = null;
  }
  return {
    available: backing !== null,
    get(key) {
      try {
        return backing ? backing.getItem(key) : null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        if (!backing) return false;
        backing.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try {
        backing?.removeItem(key);
      } catch {
        /* ignorera */
      }
    },
  };
}
