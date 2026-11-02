/**
 * Sökvägar med personligt eller administrativt innehåll. De får ALDRIG sparas i den delade PWA-cachen
 * (offlinepaketet), och service workern går alltid mot nätverket för dem. Delas av service workern,
 * bygget och testerna.
 */
export const PRIVATE_PREFIXES = ["/api", "/logga-in", "/min-utbildning", "/lararen", "/konto", "/aktivera"] as const;

export function isPrivatePath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  return PRIVATE_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}
