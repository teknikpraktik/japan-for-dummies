# Bildlicenser och arbetsgång för bilder

Kontrollerat 2026-11-01. Det här dokumentet beskriver vad som faktiskt kontrollerats, vilka villkor som gäller för de bilder som används och hur man lägger till fler. Den aktuella listan över bilder, fotografer och licenser finns på sidan [Bildkällor](/bildkallor/) och i `src/content/images.json`.

## Kodlicens och bildlicens är olika saker

Projektets kod omfattas inte automatiskt av samma licens som fotografierna, och fotografierna omfattas inte av någon eventuell kodlicens. **Varje bild har sin egen licens**, angiven i bildregistret, vid bilden och på sidan Bildkällor. Kopiera, återpublicera eller använd inte bilderna utanför projektet utan att kontrollera deras licens. Egen grafik (till exempel kartan) beskrivs i `src/content/media.json`.

## Vilka källor som gick att kontrollera

| Källa | Resultat 2026-11-01 | Använd? |
|---|---|---|
| **Wikimedia Commons** (`commons.wikimedia.org`, filer från `upload.wikimedia.org`) | Filsidorna kunde öppnas och licensrutan läsas. Anrop sker med beskrivande User-Agent och begränsad takt (Commons svarade ofta HTTP 429, rate limit). | **Ja** |
| **Unsplash** (`unsplash.com`) | Nåbar, men skyddad av en bot-utmaning (Anubis proof-of-work, HTTP 401 på `/.within.website`). Fotosidor och licenssidan kunde inte läsas utan att kringgå skyddet, vilket vi inte gör. `api.unsplash.com` nekas av sessionens nätverkspolicy (403). | Nej: villkoren kunde inte kontrolleras |
| **Pexels** (`www.pexels.com`) | Sajten svarar HTTP 403 mot automatiska klienter (även licenssidan). | Nej: villkoren kunde inte kontrolleras |
| `thumb.wikimedia.org`, `en.wikipedia.org`, `api.openverse.org` | Nekas av sessionens nätverkspolicy (403 vid CONNECT). | Nej |

Inget Unsplash- eller Pexels-material används, och därmed inget Unsplash+-material. Tidigare versioner av det här dokumentet innehöll en allmän beskrivning av Unsplash- och Pexels-licenserna från minnet. Den är borttagen eftersom den inte kunde verifieras.

## Villkor som lästes på Commons-sidorna och hur de tillämpas

Varje bild har en egen Commons-filsida (länkad som `sourceUrl`), och varje bild har en licensruta. Följande licenser förekommer. Texten nedan återger det som stod i licensrutorna.

- **CC0 1.0** (Creative Commons Zero, Public Domain Dedication): upphovspersonen har avstått från alla rättigheter i hela världen, inklusive närliggande rättigheter, i den utsträckning lagen tillåter. Inga villkor. Vår användning (webbpublicering, lokal lagring och offlinepaket, nedskalning och beskärning, lagring i publikt GitHub-repo) omfattas. Fotografen anges ändå.
- **CC BY 2.0 / 3.0 / 4.0** (Attribution): licensrutan anger att verket får delas (kopieras, distribueras och överföras) och bearbetas, under villkoret *attribution*: man måste ange upphovsperson på lämpligt sätt, ge länk till licensen och ange om ändringar har gjorts, utan att antyda att licensgivaren stödjer användningen. Det finns ingen "share alike"-klausul, och inget som begränsar lagring i publikt repo eller offlinepaket. Villkoret uppfylls genom kreditrad vid bilden (fotograf, licensnamn och licenslänk), länk till originalet, uppgift om bearbetning på Bildkällor och beskrivningen av ändringar i `modification`.
- **Public domain** (historiska original): Commons licensruta anger att verket är i det fria i ursprungslandet och i länder där skyddstiden är upphovspersonens liv plus 70 år eller kortare. Upphovspersonerna är döda sedan långt över 70 år. En trogen återgivning av ett tvådimensionellt verk i det fria skapar enligt Commons-praxis ingen ny upphovsrätt. Gäller fotografiet av Raimund von Stillfried (1881) och bildrullan från British Museum (1854–1858, kategoriserad CC-PD-Mark).
- **CC0-märkta museiverk:** träsnittet av Hiroshige kommer från The Metropolitan Museums öppna samling och är på Commons märkt CC0.

Det vi **inte** har gjort: läst licenstexternas fulla juridiska text på creativecommons.org (de är inte på sessionens tillåtna värdlista), eller fått juridisk granskning. Commons-sidans licensruta och den kända CC-strukturen är underlaget. Ingen ny tillståndsgivning har påståtts.

### Tillämpning på `usageCleared`

`usageCleared` anger att varje bilds licens, så som den står på originalsidan, medger de fyra användningarna: webbpublicering, offlinepaket (lokal lagring i användarens cache), nödvändig bearbetning, och lagring av bildfilen i ett publikt repo. För CC0, CC BY och public domain följer det av licenserna enligt ovan. Fältet `licenseEvidence` i varje registerpost beskriver vad som lästes och hur villkoren tillämpas. Ingen separat överenskommelse eller tillstånd har hittats på.

### Kvarstående osäkerheter

- **Varumärken och logotyper** i några bilder (Lawson, Matsuya, Yoshinoya) ingår inte i fotografens licens. Bilderna används redaktionellt i utbildningssyfte och bildtexterna beskriver dem sakligt. Byt bild om det bedöms olämpligt.
- **Commons-uppgifter** (fotograf, datum, plats) kommer från filsidan och är inte oberoende kontrollerade. Plats och år anges endast när de framgår av filsidans beskrivning, datum eller kategorier (fältet `verifiedBy` anger vilket).
- **ShareAlike:** bilder under CC BY-SA används inte, förutom de som anges som sådana på Bildkällor. För en CC BY-SA-bild gäller att bearbetningen (skalade och beskurna filer) ska publiceras under samma licens.
- Bilderna har inte granskats av en jurist.

## Arbetsgång för att lägga till en bild

1. Hitta bilden (Commons: sökning/kategorier). Prioritera CC0, public domain och CC BY. Undvik CC BY-SA, CC BY-NC och CC BY-ND (ND/NC är oförenliga med bearbetning/projektets användning).
2. Öppna **filens informationssida** och kontrollera: upphovsperson, licensruta, datum, beskrivning, kategorier, inga tvist-/raderingsmallar, eventuella personlighets- eller varumärkesnoteringar, och att bilden inte är vattenmärkt.
3. Kontrollera att licensen medger våra fyra användningar (`usageCleared`) och eventuellt krediteringskrav. Vid tvekan: välj en annan bild.
4. Ladda ned en arbetskopia lokalt (hamnar **aldrig** i repot). Läs ev. synlig text och kontrollera att den stämmer med bildtexten.
5. Skriv en spec-fil (JSON) med registerfälten och kör `npm run images:add -- spec.json`. Skriptet optimerar bilden till WebP-varianter (högst 1440 px, mål cirka 250 kB), tar bort metadata (inkl. GPS), validerar posten mot schemat och kopplar den till bildplatsen. `preCrop` tar bort ramar och färgskalor på reproduktioner; `mobile` skapar en 4:3-beskärning kring fokuspunkten.
6. Återanvänd en bild på fler platser med `npm run images:use -- <bildId> <platsId>`.
7. Kör `npm run validate:content` (kontrollerar metadata, att filerna finns, filstorlekar och användning) och `npm run images:review` för granskningsvyn `review/contact-sheet.html` (ingår inte i bygget).
8. Bygg (`npm run build`). Bygget misslyckas om en registrerad bildfil saknas i offlinepaketet.

## Bildtexter och alt-text

- Bildtext: kort, förklarar motivet och kopplingen till kapitlet, anger om bilden är historiskt original, rekonstruktion eller nutida foto. Använd inte ett foto som belägg för generella påståenden om hela Japan eller om människors beteende.
- Alt-text: bildens relevanta innehåll i sammanhanget. Dekorativa bilder (`decorative: true`) har tom alt-text. Kapitelkort återanvänder öppningsbilden som dekorativ miniatyr.
- Observationsuppgifterna har alltid en likvärdig textuppgift ("Utan bild").
