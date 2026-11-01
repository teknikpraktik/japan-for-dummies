# Japanresan 2027

Svenskspråkig, interaktiv förberedelse inför en skolresa till Japan i oktober 2027 (16 elever, 3 lärare). Responsiv webbplats och installerbar PWA. Ingen databas, inga elevkonton, inga betalda tjänster och inga AI-anrop.

**Status: pilot.** 12 teman och 60 planerade kapitel finns i planen. **6 kapitel är färdiga**; de övriga 54 har titel, lärandemål och beskrivning och visas som *Kommer senare*. De sex pilotkapitlen är skrivna och kontrollerade men **behöver granskas av en person** innan de används som facit (se [docs/CONTENT.md](docs/CONTENT.md#faktagranskning)).

## Starta lokalt

Kräver Node 20.9 eller senare (utvecklat med Node 22).

```bash
npm ci
npm run dev
```

Öppna http://localhost:3000. Service workern är avstängd i utvecklingsläge. Testa offline och installation mot ett produktionsbygge:

```bash
npm run build
npm start
```

Öppna http://localhost:3000 (produktionsbygget serveras från `out/`).

## Kommandon

| Kommando | Vad det gör |
|---|---|
| `npm run validate:content` | Validerar allt innehåll (körs automatiskt före bygget) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Enhetstester (Vitest): poäng, framsteg, lagring, import, innehållsvalidering, övningar och test |
| `npm run build` | Statisk export till `out/` och bygger service worker och offlinelista |
| `npm run test:e2e` | Playwright mot `out/` (bygg först). Sätt `CHROMIUM_PATH` om du vill använda en befintlig Chromium |
| `npm run make:map` | Genererar kartbilden ur Natural Earth-data |
| `npm run make:icons` | Genererar appikonerna |
| `npm run images:optimize -- <fil> <id>` | Optimerar ett fotografi till lokala WebP-varianter (se docs/IMAGE-LICENSES.md) |
| `npm run images:review` | Skapar lokal granskningsvy `review/contact-sheet.html` (ingår inte i bygget) |

## Teknik

Next.js 16 (App Router, statisk export), React 19, TypeScript 6, Tailwind CSS 4, Zod, Serwist (service worker), Vitest och Playwright. Beroenden är låsta i `package-lock.json`.

**Bilder:** fotografiernas licens är separat från kodens, och inga fotografier är valda än (reservytor visas). Se [bildlicenser](docs/IMAGE-LICENSES.md) och [bildplan](docs/IMAGE-PLAN.md).

Läs mer: [innehållsarbete](docs/CONTENT.md) · [GitHub och Vercel](docs/DEPLOY.md) · [arkitektur och PWA](docs/ARCHITECTURE.md) · [tillgänglighet och kontroller](docs/QUALITY.md) · [antaganden](docs/ASSUMPTIONS.md)
