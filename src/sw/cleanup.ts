import { isPrivatePath } from "../lib/private-paths";

/**
 * Vid aktivering av en ny service worker: ta bort allt som kan vara kvar från äldre versioner och som inte hör
 * hemma i den kontofria tjänsten. Personliga sidor och API-svar (privata sökvägar) rensas ur alla offlinecachar,
 * och okända cachar med tjänstens prefix men andra namn tas bort. Utbildningsinnehållet och gästframstegen
 * (localStorage) berörs inte.
 */
export async function cleanupOldPrivateData(cacheStorage: CacheStorage): Promise<void> {
  for (const name of await cacheStorage.keys()) {
    if (name.startsWith("japanresan-offline-")) {
      const cache = await cacheStorage.open(name);
      for (const req of await cache.keys()) {
        if (isPrivatePath(new URL(req.url).pathname)) await cache.delete(req);
      }
    } else if (name.startsWith("japanresan-")) {
      await cacheStorage.delete(name);
    }
  }
}
