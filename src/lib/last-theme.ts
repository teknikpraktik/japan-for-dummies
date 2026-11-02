import { createSafeStorage } from "./storage";

/** Senast besökta tema. Ingen personuppgift och inget konto; läses och skrivs bara i webbläsaren. */
export const LAST_THEME_KEY = "japanresan:v1:last-theme";

function store() {
  try {
    return createSafeStorage();
  } catch {
    return null;
  }
}

/** Returnerar sparat tema bara om det finns i innehållet. Saknat, ogiltigt eller otillgängligt lager ger null. */
export function readLastTheme(validIds: readonly string[]): string | null {
  const v = store()?.get(LAST_THEME_KEY) ?? null;
  return v && validIds.includes(v) ? v : null;
}

export function writeLastTheme(id: string): void {
  store()?.set(LAST_THEME_KEY, id);
}
