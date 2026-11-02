import { randomBytes, randomInt, randomUUID } from "node:crypto";

export const newId = () => randomUUID();

/** Lättlästa tecken: utan 0/O, 1/I/L, 8/B-förväxling hanteras genom att utesluta tvetydiga tecken. */
const CODE_ALPHABET = "23456789ACDEFGHJKMNPQRSTUVWXYZ"; // 30 tecken
const USERNAME_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // 31 tecken

function pick(alphabet: string, n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) out += alphabet[randomInt(alphabet.length)]; // randomInt är likformigt fördelat (ingen modulo-bias)
  return out;
}

/** Slumpat användarnamn som inte bygger på elevens namn (10 tecken, ca 50 bitar). */
export function generateUsername(): string {
  return pick(USERNAME_ALPHABET, 10);
}

export const CODE_LENGTH = 14;
/** Kryptografiskt slumpad inloggningskod, 14 tecken ur 30 (ca 68 bitar). Visas som XXXX-XXXX-XXXX-XX. */
export function generateLoginCode(): string {
  return pick(CODE_ALPHABET, CODE_LENGTH);
}
export function formatLoginCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, "$1-");
}
/** Eleven kan skriva med bindestreck, blanksteg och små bokstäver. */
export function normalizeLoginCode(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Slumpad token för engångslänkar (256 bitar). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}
