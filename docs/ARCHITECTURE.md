# Arkitektur, lagring och PWA

## Översikt

- **Servläge** (ingen `output: "export"`, `trailingSlash: true`, `skipTrailingSlashRedirect`): alla 60 kapitelsidor och översikter förgenereras fortfarande statiskt. Inloggning, API (`/api/*`) och privata sidor (`/logga-in`, `/min-utbildning`, `/lararen`, `/konto`, `/aktivera`) är dynamiska. Better Auth (användarnamn + 2FA), Drizzle och PostgreSQL (Neon, pooled). Databasen öppnas lazy, så bygget kräver ingen databas.
- **Innehåll** läses från `src/content/` på bygge-tid via `src/lib/content.ts` (valideras med Zod).
- **Klientlogik** i `src/lib`: `progress.ts` (rena funktioner), `store.ts` (lagring + React-hook), `storage.ts` (säker localStorage), `transfer.ts` (export/import), `scoring.ts`, `offline.ts`.

## Konton, behörighet och framsteg

- Roller `student`/`teacher` via gruppmedlemskap (`memberships`), första gruppen "Japanresan 2027". Publik registrering är stängd (avstängda Better Auth-vägar, plus Origin-kontroll på alla POST).
- Auktorisering sker på servern vid varje skyddad läsning/skrivning (`src/server/authz.ts`): roll, aktivt konto, grupp. Cookie-cache är avstängd så avaktivering och rollbyte gäller direkt. Lärare utan verifierad 2FA får 403.
- Administrativa ändringar tar `FOR UPDATE`-lås på gruppen i en transaktion; den sista användbara läraren (aktiv + 2FA) skyddas även vid samtidiga anrop.
- Framsteg: tabell `progress` (elev, kapitel, version, status, avklarad-tid). Servern rättar testsvar (`scoreQuiz`) och kontrollerar kapitel/version; upsert är monoton (avklarat går aldrig tillbaka). Synk är idempotent (op-ID). Import av gammal lokal status kräver bekräftelse, är idempotent och märks `imported`.
- Inloggningsspärr: Better Auths databasbaserade rate limit samt `login_throttle` per konto (fungerar över Vercel-instanser).
- Klienten har omfång per konto (`japanresan:v2:acct:<id>:*`; sessionStorage som standard, localStorage efter val), egen synkkö per konto och rensning vid utloggning.
- Miljöseparation: `DB_TARGET` måste stämma med `VERCEL_ENV` (`src/server/env.ts`).
- Offlinegräns: framsteg offline är en bekvämlighet, inte manipulationssäker.

## Lagring (gäst)

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
- `src/sw/sw.ts` bygger med esbuild till `public/sw.js` (`scripts/build-sw.mts`) och använder **Serwist** (`serwist`) för livscykel, routing och förladdning av reservsidan `/offline.html`. Nätverk först, med fallback till nedladdat innehåll. Hashade `/_next/static/`-filer hämtas cache först.
- `scripts/build-sw.mts` skapar `public/offline-manifest.json` från `.next/server/app/*.html`, `.next/static` och `public/` (alla filer + storlekar + bygg-id). Knappen ”Gör utbildningen tillgänglig offline” (`OfflinePanel`) hämtar alla filer till cachen `japanresan-offline-<bygg-id>`, visar förlopp, kontrollerar att varje fil finns och först därefter markeras utbildningen som offlineklar. Avbruten nedladdning kan fortsättas; otillräckligt utrymme rapporteras. Nedladdningen omfattar hela webbplatsen (cirka 4,5 MB), alltså alla sex pilotkapitel med test och karta, samt översikterna.
- Uppdatering: nya versioner väntar (`skipWaiting: false`). Information om en ny version och knappen ”Uppdatera nu” visas bara på sidan Min utbildning (`/offline/`), aldrig globalt eller i sidhuvudet; sidan laddas aldrig om av sig själv. Framsteg ligger i `localStorage` och påverkas inte; pågående test sparas. Offlineinnehållet uppdateras via knapp, och äldre cachar tas bort först när den nya är komplett.
- **Avvägning:** Serwists färdiga Next-integrationer (`@serwist/next`, `@serwist/turbopack`) förutsätter förladdning vid installation eller en serverrutt. Här behövs en användarstyrd nedladdning med förlopp och verifiering, och projektet är en ren statisk export. Därför används Serwists kärnbibliotek i en liten egen service worker.
- **Privata sökvägar** (`src/lib/private-paths.ts`: /api, /logga-in, /min-utbildning, /lararen, /konto, /aktivera) går alltid `NetworkOnly`; vid fel visas `/offline-privat.html` eller ett nätverksfel, aldrig cachat innehåll. Bygget avbryts om dessa hamnar i offlinelistan, och nedladdningen avvisar svar med `Set-Cookie` eller `private/no-store`. Next-konfigurationen sätter `no-store` på API och privata sidor. Både `public/sw.js` och `public/offline-manifest.json` genereras vid bygget och checkas inte in.

## Bilder och offline

- Bildfiler ligger i `public/images/<id>/` (WebP, flera bredder, ev. 4:3-mobilvarianter) och hamnar automatiskt i `public/` och därmed i `offline-manifest.json`. Manifestet innehåller även `imageFiles`/`imageBytes`, som visas i offlinepanelen (filantal och storlek, varav bilder).
- `scripts/build-sw.mts` avbryter bygget om en bildfil som bildregistret hänvisar till saknas i offlinelistan. Offlineberedskap bekräftas som tidigare först när alla filer i listan är sparade och verifierade.
- `Photo.tsx`: `<picture>` med fasta `width`/`height` (ingen layoutförskjutning), `object-position` från fokuspunkt, `loading="lazy"` utom för öppningsbilder (`priority`: eager + `fetchpriority=high`), AVIF/WebP-källor och mobilbeskärning via `media`. Reservyta när `imageId` är null.
- Redaktionsvyn `review/contact-sheet.html` skapas lokalt och ligger utanför `public/`, så den ingår aldrig i bygget eller offlinepaketet.
