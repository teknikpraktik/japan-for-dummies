# Bildlicenser och arbetsgång för bilder

**Status: inga fotografier är valda än.** Bildregistret (`src/content/images.json`) är tomt, och 20 bildplatser visar reservytor (se [IMAGE-PLAN.md](IMAGE-PLAN.md)). Skälet: sessionens nätverkspolicy nekade alla bildkällor (Unsplash, Pexels, Wikimedia Commons, Openverse, Flickr, Library of Congress). Det gick därför varken att öppna originalens informationssidor eller att kontrollera licenser. Inga bilder har valts på grundval av sökträffar, och inga bildadresser, fotografer, platser eller tillstånd har hittats på.

## Kodlicens och bildlicens är olika saker

Projektets kod omfattas inte automatiskt av samma licens som fotografierna, och fotografierna omfattas inte av någon eventuell kodlicens. **Varje fotografi har sin egen licens**, angiven i registret och på sidan [Bildkällor](/bildkallor/). Kopiera, återpublicera eller använd inte bilderna utanför projektet utan att kontrollera deras licens. Egen grafik (till exempel kartan) beskrivs i `src/content/media.json`.

## Tillåtna källor

1. Unsplash (fotografier under Unsplash-licensen).
2. Pexels (fotografier under Pexels-licensen).
3. Wikimedia Commons, främst för historiska original, föremål och faktabilder. Licensen gäller **per fil**.
4. Officiella japanska bildbanker, bara om deras villkor uttryckligen passar projektets användning.

Inte tillåtet: bilder från turistartiklar och bloggar, vattenmärkta bilder, bilder med oklar upphovsperson, betalt material eller tjänster som kräver betalning, att kringgå åtkomstbegränsningar, AI-genererade bilder som föreställer dokumentära miljöer.

## Obligatorisk kontroll för varje bild (alla punkter, på originalets informationssida)

Ett sökresultat eller en sammanfattning räcker inte. Öppna bildens egen sida och kontrollera de **aktuella** villkoren:

- [ ] Fotograf/upphovsperson och länk till informationssidan (`creator`, `sourceUrl`).
- [ ] Licensnamn och länk till licenstexten (`license`).
- [ ] Att licensen medger **webbpublicering**, **lokal lagring i offlinepaket**, **nödvändig bearbetning** (nedskalning, beskärning, färgjustering) och **lagring av bildfilen i ett publikt GitHub-repo** (`usageCleared`, alla fyra måste vara sanna). Kan publik lagring inte klarläggas: välj en annan bild eller dokumentera en separat lagringslösning.
- [ ] Eventuellt krediteringskrav (`requiredCredit`). Fotografen erkänns alltid vid bilden även när licensen inte kräver det.
- [ ] För Wikimedia Commons: filens licens (CC BY, CC BY-SA, CC0, public domain). Vid CC BY-SA gäller samma villkor för bearbetningar (beskärning räknas som bearbetning). Vid historiska original: kontrollera att verket är public domain och att fotografiet/skanningen inte har egen upphovsrätt.
- [ ] Att bilden inte är vattenmärkt och har tydlig upphovsperson.
- [ ] Identifierbara personer, särskilt barn: välj bilder utan identifierbara personer, eller dokumentera i `peopleNote` varför bilden är lämplig. Kontrollera även loggor, varumärken och konstverk i bilden.
- [ ] Plats och år: ange dem (`location`, `year`) **endast** när de är verifierade, och ange hur (`verifiedBy`).
- [ ] Att synlig text (t.ex. japanska skyltar) är avläst, översatt och stämmer med bildtexten.
- [ ] Datum för kontrollen (`rightsCheckedOn`, faktiskt datum) och vem som gjorde den (`rightsCheckedBy`).

Allmän bakgrund (från minnet, **inte verifierad i denna session**, kontrollera alltid aktuella villkor): Unsplash- och Pexels-licenserna brukar tillåta fri användning utan krav på kreditering, men med begränsningar, till exempel mot att sälja bilderna oförändrade eller bygga en konkurrerande bildtjänst. Om bilder i ett publikt repo räknas som tillåten användning måste därför bekräftas per plattform. Commons-filer har varierande licenser.

## Lägga till en bild

1. Hämta originalet lokalt (hamnar **aldrig** i repot) och genomför kontrollen ovan.
2. Optimera: `npm run images:optimize -- <original> <id> --focus 0.5,0.4 [--mobile]`. Skriptet skapar WebP-varianter (480/960/1440 px, och stående 4:5-varianter med `--mobile`) i `public/images/<id>/`, tar bort metadata (inkl. GPS) och sänker kvaliteten stegvis för att hamna under cirka 250 kB. Det skriver ut variantlistan.
3. Lägg till en post i `src/content/images.json` (se `photoSchema` i `src/lib/schema.ts`) med variantlistan, fokuspunkt, licensuppgifter, svensk bildtext och alt-text, `modification` (t.ex. "Beskuren till 3:2 och nedskalad till 1440 px"), och `usedIn` (kapitel-ID eller `home`).
4. Sätt `imageId` på bildplatsen (`hero`, `photo`-block eller `home.json`).
5. Kör `npm run validate:content` (kontrollerar metadata, att filerna finns lokalt, att storlekarna stämmer, att bilden används där `usedIn` säger) och `npm run images:review` för en lokal granskningsvy (`review/contact-sheet.html`, ingår inte i bygget).
6. Bygg (`npm run build`). Bygget misslyckas om en registrerad bildfil saknas i offlinepaketet.

## Alt-text och bildtexter

- Bildtext: kort, förklarar motivet och kopplingen till kapitlet. Använd inte ett foto som belägg för generella påståenden om hela Japan eller om människors beteende.
- Alt-text: bildens relevanta innehåll i sammanhanget. Dekorativa bilder (`decorative: true`) har tom alt-text. Kapitelkort återanvänder öppningsbilden som dekorativ miniatyr.
- Observationsuppgifterna har alltid en likvärdig textuppgift ("Utan bild"), så att uppgiften går att genomföra utan att se bilden.
