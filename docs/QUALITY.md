# Tillgänglighet och kontroller

Mål: WCAG 2.2 AA. Nedan redovisas vad som **faktiskt kontrollerats** och vad som **inte** har kunnat kontrolleras. Körningen gjordes 2026-11-01.

## Automatiska kontroller (passerade)

| Kontroll | Resultat |
|---|---|
| Innehållsvalidering (`npm run validate:content`) | OK: 12 teman, 60 kapitel (6 publicerade, 54 planerade) |
| Lint, typkontroll | OK |
| Enhetstester (52 st) | OK: poäng och gräns 4/5, framsteg, sammanslagning/ersättning, lagring (skadad/blockerad/full), export/import inkl. ogiltiga filer, innehållsvalidering (dubbla ID, felaktiga test, saknade fält, okänd blocktyp), övningar och testflöde |
| Produktionsbygge | OK (statisk export + service worker, 357 filer) |
| E2E mot produktionsbygget, Chromium desktop och mobil (Pixel 5-profil) | 58 godkända, 6 avsiktligt överhoppade (offlinetester körs bara på desktop) |

E2E täcker: alla sex pilotkapitel från direktlänk till avklarat test; 3/5 ger inte Klar, 4/5 ger Klar, omförsök bevarar bästa resultat; framsteg och pågående test överlever omladdning; favoriter; export, import av ogiltig fil/fel struktur, sammanslagning och ersättning med bekräftelse; planerade kapitel visas som ”Kommer senare”; tangentbordsstyrning; **offline** (servern stängs av på riktigt): nedladdning med förlopp och verifiering, omladdning, direktlänkar, genomfört test och sparade framsteg offline, offlinemeddelande för sida som inte laddats ned, avbruten nedladdning (ej ”klar”, kan fortsättas), uppdateringsflöde med bevarat pågående test.

## Konton, behörighet och offline (server-läge)

- Servertester (Vitest mot lokal PostgreSQL): elev A kan inte läsa/ändra B (även direkta API-anrop), elever kan inte skapa konton/ändra roller/använda admin, lärare når inte annan grupp, publik registrering stängd, första läraren kan inte kapas via e-post, 2FA och återställning, ny kod och avaktivering stoppar gamla inloggningar, sista läraren skyddas (även samtidigt), idempotent synk och import, Origin/CSRF.
- E2E (Playwright, produktionsbygge, lokal e2e-databas): inloggning, matris, synk och köad synk utan dubbletter, ingen automatisk import, delade enheter och kontobyte utan läckage, lärarflöden, privata svar och sidor hamnar aldrig i offlinecachen, axe på inloggnings-, elev- och lärarsidor.
- Kör `npm run check` och sedan `npm run build && npm run test:e2e` (desktop och mobil).

## Tillgänglighet

Kontrollerat:
- **axe-core** (WCAG 2.0/2.1/2.2 A och AA-regler, inkl. färgkontrast) utan avvikelser på startsida, översikt, alla sex pilotkapitel, ett planerat kapitel, resepass, info, källor och efter besvarat test, både desktop och mobil. En första körning hittade länkar utan understrykning; åtgärdat.
- Ingen horisontell rullning på dessa sidor i bredderna 1280 px och Pixel 5 (393 px).
- Semantisk HTML (landmärken, rubrikhierarki, listor, tabell med caption), synliga fokusmarkeringar, skip-länk, radiogrupper i fieldset/legend, status via `role="status"/"alert"`.
- Övningar och test går att använda med enbart tangentbord; ordningsövningen använder upp/ned-knappar (ingen dragning).
- Pekmål i mobilmenyn ≥ 44 px (testat). Knappar har minst 44 px höjd i CSS.
- Textalternativ: kartan har `alt` och `<desc>`; inga andra bilder används. `prefers-reduced-motion` har en global regel i CSS (appen använder i praktiken inga animationer).

**Inte kontrollerat:** skärmläsare (NVDA, VoiceOver, TalkBack), riktiga mobila enheter, Safari/iOS och Firefox, zoom till 400 % och textavstånd manuellt, kontrastkontroll av ev. tillstånd som axe inte når, manuell granskning av alla WCAG 2.2-kriterier. Automatiska verktyg fångar bara en del av problemen: genomför en manuell granskning innan bred användning. Layout kontrollerades visuellt på skärmdumpar, med en stickprovsgranskning (mobil och dator) och ingen överlappning observerades.

## Övrigt som inte har kunnat testas

- **Publicering på Vercel**: inte genomförd eller verifierad (se DEPLOY.md).
- **Neon**: ingen anslutning har gjorts från utvecklingsmiljön (nätverksbegränsning); allt är testat mot lokal PostgreSQL. Migreringar, pooled-anslutning, preview/produktion-separation och återställning av säkerhetskopia är inte verifierade mot Neon (se OPERATIONS.md).
- **Verklig användning**: skärmläsare i inloggnings- och adminvyer, riktiga mobila enheter, Safari/iOS, och TOTP med riktig autentiseringsapp är inte testade (e2e använder genererade koder).
- **Installation som app** (installationsprompt, hemskärm, iOS): kod och instruktioner finns, men installationen är inte testad på riktiga enheter. Manifest och ikoner finns.
- **Otillräckligt lagringsutrymme** vid offlinenedladdning: logiken finns (förhandskontroll av kvot och fångst av `QuotaExceededError`), men har inte provocerats fram i test.
- **Primärkällor**: kunde inte öppnas, se CONTENT.md. Faktainnehållet behöver granskas av en person.

## Bilder

18 fotografier från Wikimedia Commons är valda och integrerade (19 av 20 bildplatser fyllda; en saknar bild, se [IMAGE-PLAN.md](IMAGE-PLAN.md)). Licensunderlag: [IMAGE-LICENSES.md](IMAGE-LICENSES.md).

Kontrollerat (2026-11-01):

- **Rättigheter:** varje bilds Commons-filsida öppnades och licensrutan lästes (CC0, CC BY 2.0/3.0/4.0, public domain). Underlaget står i `licenseEvidence` per bild. Unsplash och Pexels kunde inte kontrolleras (bot-skydd respektive 403) och används inte.
- **Automatiska kontroller:** `validate:content` och enhetstester fångar saknade lokala bildfiler, felaktig filstorlek, ofullständig metadata (fotograf, källa, licens, kontrolldatum, bildtext, bearbetning, användning, `usageCleared`), alt-text (tom för dekorativa, annars krävs text), externa bildlänkar, kontrolldatum i framtiden och `usedIn`-konsistens. Bygget misslyckas om en registrerad bildfil saknas i offlinelistan.
- **Layout:** alla bilder har `width`/`height` och alt-attribut, och layoutförskjutning (CLS) < 0,02 på alla sex kapitelsidor (e2e, desktop och mobil). Ingen horisontell rullning och axe utan avvikelser på alla sidor inkl. Bildkällor.
- **Mobilbeskärning:** öppningsbilder har en särskild 4:3-fil för mobil, och förklarande bilder beskärs med fokuspunkt. Beskärningen granskades visuellt på skärmdumpar (mobil och dator) för alla bilder. Inga ansikten syns. En bakgrundsperson (automaten i kapitel 6) och en backljus-silhuett (Shimbashi) är bortbeskurna.
- **Offline:** efter nedladdning (430 filer, 10,9 MB, varav 68 bildfiler på 5,8 MB) och omladdning utan nätverk laddas alla bilder på startsidan och sex kapitelsidor (e2e).
- **Prestanda:** största bildfil per bild är under 250 kB utom en (Shimbashi, 269 kB; gränsen för fel är 400 kB). Öppningsbilden prioriteras (`eager`, `fetchpriority=high`), övriga bilder laddas lazy.
- Befintliga test, framsteg och export/import fungerar (alla tidigare e2e- och enhetstester passerar).

**Inte gjort:** juridisk granskning av licenserna, manuell kontroll med skärmläsare av bildtexter och alt-texter, granskning av bildtexternas japanska av en person som kan japanska (texterna lästes av mig i bilderna och stämmer med det som syns, men en ofarlig tolkning av t.ex. 降りる人が優先です bör bekräftas), test på riktiga mobiler.
