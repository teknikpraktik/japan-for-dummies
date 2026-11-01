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
- **Installation som app** (installationsprompt, hemskärm, iOS): kod och instruktioner finns, men installationen är inte testad på riktiga enheter. Manifest och ikoner finns.
- **Otillräckligt lagringsutrymme** vid offlinenedladdning: logiken finns (förhandskontroll av kvot och fångst av `QuotaExceededError`), men har inte provocerats fram i test.
- **Primärkällor**: kunde inte öppnas, se CONTENT.md. Faktainnehållet behöver granskas av en person.

## Bilder (tillägg)

Inga fotografier är valda (se [IMAGE-LICENSES.md](IMAGE-LICENSES.md)), så produktionsbygget visar reservytor. Bildkomponenterna, registret, pipeline och kontrollerna är däremot testade:

- Enhetstester: bildmetadata (saknade obligatoriska fält, ogiltiga sökvägar/externa länkar, tom/ifylld alt-text för dekorativa bilder, kontrolldatum i framtiden, `usageCleared`), **saknade lokala bildfiler**, felaktig filstorlek, storleksgränser, `usedIn`-konsistens, offlinelistan (`missingFromManifest`), bildoptimeringen (varianter, mått, storlek, mobilbeskärning) och komponenterna (fasta mått, lazy/eager, `fetchpriority`, srcset, fokuspunkt, kreditering och länkar, reservyta).
- Layout- och offlinetest kördes en gång med **20 syntetiska testbilder** (tydligt märkta, inga fotografier, ej incheckade): 16:9-hero/3:2-kort/4:3-mobil, rätt mobilvariant vald, layoutförskjutning (CLS) 0, ingen horisontell rullning, axe utan avvikelser, och alla bilder laddades offline efter nedladdning och omladdning (436 filer, 5,6 MB, varav 74 bildfiler 508 kB för syntetiska bilder).
- **Inte gjort:** granskning av verkliga fotografier (beskärning av ansikten och detaljer, bildtextens riktighet, rättigheter).
