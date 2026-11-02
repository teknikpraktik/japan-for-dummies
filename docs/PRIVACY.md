# Personuppgifter och dataskydd

> **Obs:** Det här dokumentet beskriver kontoläget (inloggning, läraradministration), som är **avstängt som standard**. Den kontofria tjänstens integritetsinformation finns på sidan `/integritet/` i appen. Se [OPERATIONS.md](OPERATIONS.md).

Tjänsten är byggd för dataminimering. Uppgifterna är **pseudonymiserade, inte anonyma**: en lärare kan koppla ett användarnamn till en elev. Dokumentet är ingen juridisk bedömning och ersätter inte skolans egna beslut.

## Vad som lagras centralt

- Elev: användarnamn (slumpat), visningsnamn (förnamn/alias som läraren angett), intern identifierare, lösenordshash av inloggningskoden, sessioner, gruppmedlemskap, aktiv/avaktiverad.
- Framsteg: elev, kapitel-ID och version, status (påbörjat/avklarat), avklarad-tid, källa (test eller importerad egenrapport), senaste synk.
- Lärare: inloggningsadress, namn, lösenordshash och, om läraren själv aktiverat tvåfaktor, TOTP-hemlighet och återställningskoder (hanteras av Better Auth).
- Begränsad säkerhetslogg (konto-, roll- och kodändringar; inga hemligheter) och tekniska uppgifter för spärr mot gissning av inloggning (IP-baserad nyckel och räknare, kortlivade).

Lagras **inte**: e-post, personnummer, födelsedatum, telefon, efternamn, felaktiga svar, klick, lästid, reflektioner, försökshistorik, hälsa/allergi/stödbehov/skyddad identitet. Inga annonser, spårare, publika profiler eller topplistor.

## Lokalt i webbläsaren

Som gäst sparas framsteg i enheten (localStorage). För inloggade sparas inget personligt kvar i enheten som standard (sessionStorage rensas när fliken stängs); eleven kan välja att spara på egen enhet. Utloggning rensar lokala uppgifter och varnar om osynkade framsteg. Lärardata sparas aldrig offline. Sessionstoken ligger i HttpOnly-cookie.

## Skolan/rektorn måste avgöra (ej fastställt här)

- Personuppgiftsansvarig och kontaktväg; dataskyddsombud. (`PRIVACY_CONTROLLER_NAME`, `PRIVACY_CONTACT`, `PRIVACY_DPO_CONTACT`; inget är påhittat.)
- Rättslig grund för behandlingen (inga samtyckesrutor i tjänsten ersätter detta; eleverna kan vara minderåriga).
- Bedömning av leverantörerna (Vercel, Neon; region och eventuella tredjelandsöverföringar) och personuppgiftsbiträdesavtal.
- Gallring/lagringstid (`PRIVACY_RETENTION_POLICY`); ingen tid är vald här.
- Behov av konsekvensbedömning (DPIA).
- Hur arkivlagstiftning och gallring förhåller sig till varandra.

## Avaktivering, export, radering

- Avaktivering stoppar inloggning och avslutar sessioner men behåller uppgifter.
- Individuell export görs av läraren (Lärare → Elever → Exportera).
- Radering tar bort kontot och dess framsteg via gränssnittet. Efter radering finns uppgifter kvar i databassäkerhetskopior tills de roterat ut enligt Neons kvarhållningstid, och säkerhetsloggen behåller identitetsnummer (inte namn) för spårbarhet. Skolan beslutar om loggens och säkerhetskopiornas kvarhållning och eventuell arkivskyldighet.
- Gallring efter tid: ingen automatisk gallring är påslagen eftersom ingen tid fastställts; raderingen kan göras av lärare per elev tills skolan beslutat.

## Offline och manipulation

Offlineframsteg är en bekvämlighet och inte manipulationssäkert. Servern kontrollerar kapitel, testversion och rättade svar vid synk online; avklarat kan aldrig gå tillbaka. Äldre lokala framsteg importeras aldrig automatiskt, utan efter förhandsvisning och bekräftelse, märkta som egenrapporterade.

## Kontofri tjänst (nuvarande läge)

- Inget konto behövs. Framsteg (påbörjade och klara kapitel, testresultat, pågående test), senast valt tema och uppgift om offlinenedladdning sparas lokalt i webbläsaren (localStorage). Inget av det skickas till servern.
- Offlinenedladdning lagrar utbildningsmaterial i webbläsarens cache (inga personuppgifter).
- Rensning: knappen på `/offline/`, eller webbläsarens inställningar.
- Driftleverantören Vercel kan logga tekniska uppgifter om anrop; detta är inte närmare kontrollerat.
- Appen sätter inga kakor (kontrolleras i e2e-testerna och mot produktionen).
- Ansvarig: Per Björkman, för den behandling han bestämmer över i den fristående tjänsten. Kontaktuppgift saknas och visas som ej angiven tills `PRIVACY_CONTACT` sätts.
- Befintliga uppgifter från den tidigare kontoversionen (om några) ligger kvar i databasen men används inte av appen. Radering eller gallring är en separat förvaltningsfråga.
