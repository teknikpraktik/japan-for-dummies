# Japanresan 2027

Svenskspråkig, interaktiv förberedelse inför en skolresa till Japan i oktober 2027 (16 elever, 3 lärare). Responsiv webbplats och installerbar PWA. Utbildningen kan användas som gäst utan konto; elever och lärare kan logga in (inga publika registreringar) så att läraren ser framsteg per elev. Data lagras i PostgreSQL (Neon). Inga annonser, spårare eller AI-anrop.

**Status: pilot.** 12 teman och 60 planerade kapitel finns i planen. **6 kapitel är färdiga**; de övriga 54 har titel, lärandemål och beskrivning och visas som *Kommer senare*. De sex pilotkapitlen är skrivna och kontrollerade men **behöver granskas av en person** innan de används som facit (se [docs/CONTENT.md](docs/CONTENT.md#faktagranskning)).

## Starta lokalt

Kräver Node 20.9 eller senare (utvecklat med Node 22) och en lokal PostgreSQL för inloggning, API och tester. Se [docs/OPERATIONS.md](docs/OPERATIONS.md).

```bash
npm ci
cp .env.example .env.local   # fyll i lokala värden
npm run db:migrate
npm run db:seed:synthetic    # syntetiska elever och lärare
npm run dev
```

Öppna http://localhost:3000. Service workern är avstängd i utvecklingsläge. Testa offline och installation mot ett produktionsbygge:

```bash
npm run build
npm start
```

Öppna http://localhost:3000 (Next.js i servläge).

## Kommandon

| Kommando | Vad det gör |
|---|---|
| `npm run validate:content` | Validerar allt innehåll (körs automatiskt före bygget) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Enhetstester (Vitest): poäng, framsteg, lagring, import, innehållsvalidering, övningar och test |
| `npm run build` | Next.js-bygge (servläge) samt service worker och offlinelista |
| `npm run db:migrate` / `db:generate` | Kör / skapar Drizzle-migreringar |
| `npm run db:seed:synthetic` | Syntetiska elever (aldrig mot produktion) |
| `npm run admin:bootstrap` / `admin:recover` | Operatörskommandon: första läraren / kontoåterställning |
| `npm run test:e2e` | Playwright mot produktionsbygget och lokal e2e-databas (bygg först). Sätt `CHROMIUM_PATH` om du vill använda en befintlig Chromium |
| `npm run make:map` | Genererar kartbilden ur Natural Earth-data |
| `npm run make:icons` | Genererar appikonerna |
| `npm run images:optimize -- <fil> <id>` | Optimerar ett fotografi till lokala WebP-varianter (se docs/IMAGE-LICENSES.md) |
| `npm run images:add -- <spec.json>` / `images:use` | Lägger till en bild i registret (efter rättighetskontroll) / återanvänder den på en annan bildplats |
| `npm run images:review` | Skapar lokal granskningsvy `review/contact-sheet.html` (ingår inte i bygget) |

## Teknik

Next.js 16 (App Router, servläge med statiskt genererat offentligt innehåll), Better Auth, Drizzle och PostgreSQL, React 19, TypeScript 6, Tailwind CSS 4, Zod, Serwist (service worker), Vitest och Playwright. Beroenden är låsta i `package-lock.json`.

**Bilder:** 18 fotografier från Wikimedia Commons (CC0, CC BY, public domain). Fotografiernas licens är separat från kodens. Se sidan Bildkällor i appen, [bildlicenser](docs/IMAGE-LICENSES.md) och [bildplan](docs/IMAGE-PLAN.md).

Läs mer: [innehållsarbete](docs/CONTENT.md) · [GitHub och Vercel](docs/DEPLOY.md) · [arkitektur och PWA](docs/ARCHITECTURE.md) · [tillgänglighet och kontroller](docs/QUALITY.md) · [antaganden](docs/ASSUMPTIONS.md) · [drift och Neon](docs/OPERATIONS.md) · [lärarguide](docs/TEACHERS.md) · [personuppgifter](docs/PRIVACY.md)
