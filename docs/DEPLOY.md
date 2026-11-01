# GitHub och Vercel

Projektet körs som Next.js i **servläge** (Vercel-kompatibelt; ingen `output: "export"` längre). Offentligt innehåll förgenereras fortfarande statiskt; inloggning, API och lärarsidor körs som serverfunktioner mot PostgreSQL. Vercels Git-integration räcker, men miljövariabler och en databas krävs nu: se [OPERATIONS.md](OPERATIONS.md). CI i GitHub Actions kontrollerar kvaliteten, men publicerar inte.

## GitHub

Remote: `https://github.com/teknikpraktik/japan-for-dummies.git`. Standardgren: `main`.

```bash
git push -u origin main
```

CI (`.github/workflows/ci.yml`) körs vid push till `main` och vid pull request: `npm ci`, innehållsvalidering, lint, typkontroll, enhetstester, produktionsbygge och e2e-tester (Playwright mot produktionsbygget, med lokal PostgreSQL som CI-tjänst).

## Vercel

1. Logga in på Vercel och välj **Add New… → Project**.
2. Importera GitHub-repot `teknikpraktik/japan-for-dummies` (ge Vercels GitHub-app åtkomst till repot om det efterfrågas).
3. Framework preset ska bli **Next.js**. `vercel.json` anger installations- och byggkommando (`npm ci`, `npm run build`). Output hanteras av Next.js (`.next`). Lämna övriga inställningar.
4. Miljövariabler per scope (Production/Preview) enligt [OPERATIONS.md](OPERATIONS.md). Preview får aldrig produktionsdatabasen; appen vägrar starta om `DB_TARGET` och `VERCEL_ENV` inte stämmer. Migrera databasen manuellt före första publicering och skapa första läraren med `npm run admin:bootstrap`.
5. **Production Branch** = `main`: varje push till `main` publiceras till produktion.
6. Alla andra grenar och pull requests får egna förhandsvisningar (preview-URL:er).

Cache- och säkerhetsrubriker sätts i `next.config.ts` (`sw.js` och `offline-manifest.json`: `no-cache`; `/api` och privata sidor: `no-store`).

Valfritt: gör CI-jobbet obligatoriskt under *Settings → Branches → Branch protection* i GitHub så att Vercel-förhandsvisningar och merge kräver grön CI.

## Efter publicering

Kontrollera på den publicerade adressen: att startsidan laddas, att `/kapitel/japan-pa-kartan/` fungerar som direktlänk, att `/manifest.webmanifest` och `/sw.js` svarar, och att ”Gör utbildningen tillgänglig offline” blir klar. Se [QUALITY.md](QUALITY.md).

## Om en domän byts

Allt är relativt till roten (`/`). Appen måste serveras från domänens rot (inte en underkatalog), eftersom service workerns scope och manifestets `start_url` är `/`.
