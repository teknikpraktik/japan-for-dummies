# Drift: miljöer, Neon, migreringar och återställning

Det här dokumentet är för den som driftsätter tjänsten. Inga hemligheter står här. Alla värden läggs i Vercels skyddade miljövariabler eller i en lokal `.env.local` som aldrig checkas in (`.env*` är ignorerat av git).

> **Standardläget är kontofritt.** Tjänsten byggs och körs utan databas och utan autentiseringsvariabler: ingen inloggning, ingen läraradministration och ingen synkning. Framsteg sparas lokalt i webbläsaren. Resten av det här dokumentet gäller bara om kontofunktionerna **slås på igen** (se nästa avsnitt). Befintliga Neon-projekt, tabeller och uppgifter är orörda men används inte av den kontofria appen; vad som ska hända med dem är en separat förvaltningsfråga.

## Kontofunktioner: avstängda som standard

En enda inställning styr: `NEXT_PUBLIC_ACCOUNTS_ENABLED` (se `src/lib/features.ts`). Den är avstängd om den saknas eller har något annat värde än `true`. Eftersom Next.js bäddar in `NEXT_PUBLIC_`-variabler vid bygget gäller värdet **vid bygget**, så servern och klienten alltid är överens; ändra den och bygg om.

När den är avstängd:

- `src/proxy.ts` svarar `404` på `/api/*` och på kontosidorna (`/logga-in`, `/min-utbildning`, `/lararen`, `/konto`, `/aktivera`) innan någon kod körs. Ingen autentisering eller databas initieras och inga kakor sätts, även om webbläsaren skickar en gammal sessionskaka.
- Sidorna och API-rutterna har dessutom egna spärrar (404), som skydd i flera led.
- Webbläsaren gör inga anrop om session, användare eller synkning, och kontomeny, inloggningslänkar och lärarlänkar visas inte.
- `DATABASE_URL`, `DB_TARGET` och `BETTER_AUTH_SECRET` krävs inte.

Återaktivering: sätt `NEXT_PUBLIC_ACCOUNTS_ENABLED=true` och variablerna i tabellen nedan, och bygg om. Tester för båda lägena: `npm run test:e2e` (kontofritt, standard) och `npm run build:konton && npm run test:e2e:konton` (kontoläge, lokal PostgreSQL).

## Miljövariabler (gäller kontoläget)

| Variabel | Krävs | Beskrivning |
|---|---|---|
| `DATABASE_URL` | ja | PostgreSQL-anslutning. På Vercel: Neons **pooled**-sträng (host med `-pooler`). Server-only, aldrig `NEXT_PUBLIC_`. |
| `DB_TARGET` | ja | `development`, `test`, `preview` eller `production`. Måste stämma med `VERCEL_ENV`; annars vägrar appen starta (preview mot produktion och omvänt blockeras). |
| `BETTER_AUTH_SECRET` | ja | Minst 32 slumpade tecken (`openssl rand -base64 48`). Olika värde per miljö. Byte loggar ut alla. |
| `BETTER_AUTH_URL` | produktion | Publik bas-URL (exakt, utan jokertecken). På preview används Vercels egna URL:er. |
| `AUTH_RATE_LIMIT_ENABLED` | nej | `false` bara i automatiska tester. |
| `PRIVACY_*` | nej | Används inte längre av den kontofria integritetssidan; sidans text är fast. De fanns för kontoläget. |
| `CONFIRM_OPERATOR_ACTION=yes` | vid operatörskommandon mot produktion | Extra bekräftelse för `admin:bootstrap` och `admin:recover`. |
| `CONFIRM_PRODUCTION_MIGRATION=yes` | vid `db:migrate` mot produktion | Extra bekräftelse; ta först en återställningspunkt (Neon-branch från production). |

## Miljöseparation

- **dev/test:** lokal PostgreSQL (databaserna `japanresan_dev`, `japanresan_test`, `japanresan_e2e`). Testsetupen vägrar köra mot en icke-lokal värd. Syntetiska elever används.
- **preview:** egen Neon-**branch** (t.ex. `preview`) med egen `DATABASE_URL` satt endast för Vercels scope *Preview*, och `DB_TARGET=preview`. Produktionens sträng får inte sättas i Preview-scope.
- **production:** Neons produktionsbranch, scope *Production*, `DB_TARGET=production`.
- Syntetisk data (`npm run db:seed:synthetic`) vägrar köra mot `DB_TARGET=production`.

## Koppla Neon (användaren gör webbläsarinloggningen)

1. Följ <https://neon.com/prompts/agent-setup.md>: kör `npx neonctl@latest init` lokalt och logga in i webbläsaren. Välj det befintliga projektet "japan-for-dummies" (AWS eu-central-1). Skapa inget nytt projekt.
2. Skapa en Neon-branch för preview. Hämta pooled-strängar för båda.
3. I Vercel (*Settings → Environment Variables*): sätt `DATABASE_URL`, `DB_TARGET`, `BETTER_AUTH_SECRET` (och `BETTER_AUTH_URL` för produktion) per scope enligt ovan. Markera som *Sensitive*.
4. Använd **inte** Neons hanterade Better Auth. Better Auth körs som bibliotek i appen.

## Migreringar (Drizzle)

Schemat finns i `src/server/db/schema.ts`; SQL-migreringar i `drizzle/`.

```bash
npm run db:generate          # efter schemaändring: skapar ny SQL-fil i drizzle/
DATABASE_URL=<sträng> DB_TARGET=preview npm run db:migrate
```

Kör migreringen mot preview först, sedan produktion (`DB_TARGET=production CONFIRM_PRODUCTION_MIGRATION=yes`, efter att du skapat en Neon-branch av production som återställningspunkt). Migreringar körs inte automatiskt vid Vercel-bygget. Migreringar är additiva; granska SQL innan produktion. Sätt strängen i miljön för kommandot utan att skriva den i skalhistoriken (till exempel `read -rs DATABASE_URL; export DATABASE_URL`).

## Skapa första läraren

Ett explicit engångskommando med databasåtkomst. Det finns ingen publik väg och ingen automatisk befordran via e-post.

```bash
export DB_TARGET=production CONFIRM_OPERATOR_ACTION=yes
read -rs DATABASE_URL && export DATABASE_URL
npm run admin:bootstrap -- --email per.a.bjorkman@gmail.com --name "Per"
```

Lösenordet frågas dolt (alternativt via stdin eller `BOOTSTRAP_TEACHER_PASSWORD`; aldrig som parameter), minst 12 tecken. Kommandot är säkert att köra om: ett befintligt konto ändras eller återställs inte. Läraren kan logga in direkt med e-postadress och lösenord. Tvåfaktor (TOTP) är valfritt och kan aktiveras under Konto. Gruppen "Japanresan 2027" skapas om den saknas. Om gruppen redan har lärare vägrar kommandot lägga till fler utan `--allow-additional`; ytterligare lärare bjuds in i gränssnittet.

## Kontoåterställning (operatör)

Lärare som förlorat lösenord och återställningskoder, och som är **den enda** läraren (finns andra lärare kan de bjuda in ett nytt konto): 

```bash
export DB_TARGET=production CONFIRM_OPERATOR_ACTION=yes
read -rs DATABASE_URL && export DATABASE_URL
npm run admin:recover -- --email <adress> --new-password --reset-2fa --yes
```

Alla sessioner avslutas, en eventuell tvåfaktor tas bort (läraren kan aktivera en ny under Konto). Åtgärden syns i säkerhetsloggen. Det finns ingen permanent bakdörr: kräver databasåtkomst, som bara operatören har. Elevers koder återställs av lärare i gränssnittet.

## Säkerhetskopior och återställning

Neon har historik (point-in-time restore) och branchning inom projektets kvarhållningsfönster; fönstrets längd beror på plan och ska kontrolleras i Neon-konsolen. Ställ gärna också in en periodisk `pg_dump`.

**Verifierad återställning ska övas före skarp drift** (ej utfört, ingen Neon-åtkomst här):

1. Skapa en Neon-branch från ett tidigare tillstånd (eller `pg_dump`/`pg_restore` till en tom databas).
2. Kör `DATABASE_URL=<restore-branch> DB_TARGET=preview` mot appen eller en `psql`-kontroll: antal rader i `user`, `memberships`, `progress`.
3. Logga in som syntetisk användare mot återställningen och kontrollera matrisen.
4. Ta bort övningsbranchen.

Raderade uppgifter finns kvar i säkerhetskopior tills de roterat ut; se [PRIVACY.md](PRIVACY.md).

## Syntetiska elever (utveckling, test, demo)

```bash
npm run db:seed:synthetic    # kräver DB_TARGET != production
```

Lärare `larare.syntetisk@example.test`, lösenord `Syntetiskt-losenord-1`, TOTP-hemlighet `JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP` (lägg in i en autentiseringsapp). Elever `syn_elev_01` … `syn_elev_16` med koderna `SYNTETISKELEV01` … `SYNTETISKELEV16`. Dessa är offentligt kända värden och får aldrig finnas i en riktig miljö.

## Lokal utveckling

```bash
cp .env.example .env.local   # fyll i lokala värden
npm run db:migrate
npm run build && npm start   # eller npm run dev
```
