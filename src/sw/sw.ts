/// <reference lib="webworker" />
import { CacheFirst, NetworkOnly, Serwist } from "serwist";

declare const self: ServiceWorkerGlobalScope;
// Ersätts av scripts/build-sw.ts vid bygget.
declare const __BUILD_ID__: string;

const OFFLINE_CACHE = `japanresan-offline-${__BUILD_ID__}`;
const OFFLINE_PAGE = "/offline.html";

/** Kandidat-URL:er för en sida: exakt adress, samt med/utan avslutande snedstreck. */
function candidates(request: Request): string[] {
  const url = new URL(request.url);
  const list = [url.pathname];
  if (!/\.[a-z0-9]+$/i.test(url.pathname)) list.push(url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname + "/");
  return list.filter(Boolean);
}

/** Läser enbart ur de cachar som användaren har laddat ned via ”Gör utbildningen tillgänglig offline”. */
async function fromOfflineCaches(request: Request): Promise<Response | undefined> {
  // Nästa.js klientnavigering ber om RSC-data. Saknas exakt träff låter vi webbläsaren göra en vanlig sidladdning i stället.
  const isRsc = request.headers.get("RSC") !== null;
  const names = (await caches.keys()).filter((n) => n.startsWith("japanresan-offline-")).sort().reverse();
  for (const name of names) {
    const cache = await caches.open(name);
    const exact = await cache.match(request, { ignoreVary: true });
    if (exact) return exact;
    if (isRsc) continue;
    for (const path of candidates(request)) {
      const hit = await cache.match(path, { ignoreSearch: true, ignoreVary: true });
      if (hit) return hit;
    }
  }
  return undefined;
}

const serwist = new Serwist({
  // Endast reservsidan för offline förladdas automatiskt.
  precacheEntries: [{ url: OFFLINE_PAGE, revision: __BUILD_ID__ }],
  skipWaiting: false, // Ny version väntar tills användaren väljer att uppdatera, så att pågående test inte avbryts.
  clientsClaim: true,
  navigationPreload: false,
  disableDevLogs: true,
  runtimeCaching: [
    {
      // Hashade, oföränderliga resurser: cache först.
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({ cacheName: OFFLINE_CACHE }),
    },
    {
      // Allt annat i samma origin: nätverk först, med fallback till nedladdat innehåll (se catch-handler).
      matcher: ({ request, sameOrigin }) => sameOrigin && request.method === "GET",
      handler: new NetworkOnly({ networkTimeoutSeconds: 4 }),
    },
  ],
});

serwist.setCatchHandler(async ({ request }) => {
  const cached = await fromOfflineCaches(request);
  if (cached) return cached;
  if (request.mode === "navigate" || request.destination === "document") {
    const page = await caches.match(OFFLINE_PAGE, { ignoreSearch: true, ignoreVary: true });
    if (page) return page;
  }
  return Response.error();
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") void self.skipWaiting();
  if (event.data && event.data.type === "GET_BUILD_ID") event.ports[0]?.postMessage({ buildId: __BUILD_ID__ });
});

serwist.addEventListeners();
