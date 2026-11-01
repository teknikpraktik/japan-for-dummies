# Arkitektur, lagring och PWA

## Översikt

- **Statisk export** (`output: "export"`, `trailingSlash: true`): alla 60 kapitelsidor och översikter förberäknas. Framsteg finns bara i klienten.
- **Innehåll** läses från `src/content/` på bygge-tid via `src/lib/content.ts` (valideras med Zod).
- **Klientlogik** i `src/lib`: `progress.ts` (rena funktioner), `store.ts` (lagring + React-hook), `storage.ts` (säker localStorage), `transfer.ts` (export/import), `scoring.ts`, `offline.ts`.

## Lagring

- Nyckel `japanresan:v1:state` i `localStorage`, `version: 1`. Innehåller kapitelframsteg, favoriter, senaste exportdatum och pågående testutkast.
- Saknad lagring (privat läge, blockerad): appen fungerar i minnet, banner informerar.
- Skadad lagring: texten säkerhetskopieras under `japanresan:v1:corrupt-backup`, appen börjar om och informerar.
- Skrivfel (fullt): status `write-failed` + banner; minnestillståndet behålls.
- Pågående test sparas efter varje besvarad fråga och återupptas efter omladdning.
- **Export**: JSON `{ app, dataVersion, exportedAt, data: { chapters, favorites } }`. Utkast ingår inte.
- **Import**: kontrollerar storlek (max 256 kB), JSON, app-id, dataversion och struktur (Zod, begränsade ID-format och värden) innan något ändras. Därefter val: *slå samman* (bästa resultat, tidigaste klardatum, favoriter förenas) eller *ersätt* (kräver extra bekräftelse).
- Vid ny dataversion: lägg till en migrering i `parseStoredState`/`parseImport` och höj `STATE_VERSION`.

## PWA och offline

- `src/app/manifest.ts` ger `/manifest.webmanifest`; ikoner i `public/icons/` (egen grafik).
- `src/sw/sw.ts` bygger med esbuild till `out/sw.js` (`scripts/build-sw.mts`) och använder **Serwist** (`serwist`) för livscykel, routing och förladdning av reservsidan `/offline.html`. Nätverk först, med fallback till nedladdat innehåll. Hashade `/_next/static/`-filer hämtas cache först.
- `scripts/build-sw.mts` skapar `out/offline-manifest.json` (alla filer + storlekar + bygg-id). Knappen ”Gör utbildningen tillgänglig offline” (`OfflinePanel`) hämtar alla filer till cachen `japanresan-offline-<bygg-id>`, visar förlopp, kontrollerar att varje fil finns och först därefter markeras utbildningen som offlineklar. Avbruten nedladdning kan fortsättas; otillräckligt utrymme rapporteras. Nedladdningen omfattar hela webbplatsen (cirka 4,5 MB), alltså alla sex pilotkapitel med test och karta, samt översikterna.
- Uppdatering: nya versioner väntar (`skipWaiting: false`). En ruta erbjuder ”Uppdatera nu”; sidan laddas aldrig om av sig själv. Framsteg ligger i `localStorage` och påverkas inte; pågående test sparas. Offlineinnehållet uppdateras via knapp, och äldre cachar tas bort först när den nya är komplett.
- **Avvägning:** Serwists färdiga Next-integrationer (`@serwist/next`, `@serwist/turbopack`) förutsätter förladdning vid installation eller en serverrutt. Här behövs en användarstyrd nedladdning med förlopp och verifiering, och projektet är en ren statisk export. Därför används Serwists kärnbibliotek i en liten egen service worker.
