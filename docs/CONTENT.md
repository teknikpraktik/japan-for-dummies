# Innehållsarbete

Allt utbildningsinnehåll ligger i `src/content/` som JSON, skilt från presentationskoden. Innehållet valideras av `src/lib/schema.ts` och `src/lib/content-validate.ts`. Bygget misslyckas om något är fel.

```
src/content/
  trip.json        resans namn, avresemånad, målgrupp, resmål (tom lista tills de är beslutade)
  themes.json      de 12 teman
  chapters/        färdiga kapitel, en fil per kapitel
  planned/         planerade kapitel (5 per tema, utom de som är färdiga)
  sources.json     källregister
  media.json       bilder med alt-text och rättigheter
```

## Lägga till eller ändra ett kapitel

1. Ett planerat kapitel finns redan som post i `planned/NN-tema.json`. När du skriver det: **ta bort posten där** och skapa `chapters/tNN-kNN-<slug>.json` med samma `id`, `slug`, `themeId` och `order`.
2. Sätt `"status": "published"` och fyll i alla obligatoriska fält (se schemat): `contentVersion` (≥ 1), `minutes`, `hook`, `sections`, `exercises`, `noticeOnTrip`, `reflection`, exakt 5 `quiz`-frågor, `sourceIds`, `review` och ev. `mediaIds`.
3. Höj `contentVersion` när du ändrar innehåll som påverkar elever.
4. Kör `npm run validate:content`.

Planen ska alltid omfatta **60 kapitel, 5 per tema** (valideras).

### Blocktyper (ingen godtycklig HTML)

`p`, `list`, `callout` (info/care/check), `phrases` (japansk skrift + romaji + svenska + uttalstips), `figure` (hänvisar till `media.json`), `facts`, `timeline`. I texten stöds bara `**fet**` och `*kursiv*`.

### Övningstyper

`multiple-choice`, `ordering` (ge stegen i RÄTT ordning; komponenten blandar), `scenario`. Varje svarsalternativ har egen `feedback`, så att både rätta och felaktiga svar förklaras. Exakt ett alternativ per fråga är `correct`.

### Test

Fem frågor per kapitel. Fyra rätt ger markeringen Klar (`PASS_MARK` i `src/lib/scoring.ts`). Om du byter ut frågor ändras testets signatur; pågående utkast som inte längre passar kasseras.

## Faktagranskning

Reglerna:

- Skriv egen svensk text. Hitta aldrig på källor, citat, datum eller bildlicenser.
- `review.reviewedOn` ska vara datumet då kontrollen **faktiskt** gjordes, och `review.method` ska beskriva hur.
- Sätt `review.status` till `human-reviewed` först när en person har granskat kapitlet.
- Skilj stabil bakgrundskunskap från uppgifter som måste kontrolleras nära avresa (priser, inreseregler, öppettider, tidtabeller, lokala regler). Lista de senare i `review.checkBeforeTravel`. Garantera dem aldrig för oktober 2027.
- Beskriv seder med sammanhang och variation. Undvik ”japaner är alltid …”.

**Så gjordes pilotens kontroll, och vad som återstår:** när pilotkapitlen skrevs var de flesta primärkällor (Web Japan, JNTO, MEXT m.fl.) inte nåbara från utvecklingsmiljön. Uppgifterna kontrollerades mot sammanfattade sökresultat och de källor som anges i `sources.json` har därför `access: "search-result-summary"`. Japanska fraser i kapitel 4 och 6 bygger på allmän kunskap utan källa. Samtliga pilotkapitel har `needs-human-review`. Granska dem mot primärkällorna och en japanskkunnig person innan de används.

## Bilder

Fotografier hanteras i bildregistret `src/content/images.json` och beskrivs i [IMAGE-LICENSES.md](IMAGE-LICENSES.md) och [IMAGE-PLAN.md](IMAGE-PLAN.md). Varje färdigt kapitel har en `hero` (öppningsbild) och `photo`-block (förklarande bilder); `imageId: null` betyder att bilden ännu inte är vald (reservyta). `observe`-block är observationsuppgifter som alltid har en textuppgift.

Egen grafik (kartan): endast lokala medier med kända rättigheter. Kartan är egen grafik ur Natural Earth-data. **Bekräfta Natural Earths villkor** (`natural-earth` i `sources.json` har `access: "not-checked"`). Lägg nya bilder i `public/media/`, registrera dem i `media.json` med alt-text, upphov och licens, och avstå om rättigheterna inte kan fastställas.
