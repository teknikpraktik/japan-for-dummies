/**
 * Central inställning för kontofunktionerna (inloggning, elev- och lärarkonton, synkning av framsteg,
 * läraradministration). AVSTÄNGD som standard: tjänsten är då kontofri och sparar framsteg lokalt i webbläsaren.
 *
 * Slås på med NEXT_PUBLIC_ACCOUNTS_ENABLED=true vid bygget. Variabeln läses vid bygget (Next.js bäddar in
 * NEXT_PUBLIC-värden), så servern och klienten alltid är överens. När den är avstängd:
 *  - proxy.ts svarar 404 på konto-API och kontosidor innan någon kod körs,
 *  - ingen autentisering eller databas initieras, och inga anrop om session eller synk görs från webbläsaren.
 * Koden för konton finns kvar för framtida återaktivering (se docs/OPERATIONS.md).
 */
export const ACCOUNTS_ENABLED = process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED === "true";
