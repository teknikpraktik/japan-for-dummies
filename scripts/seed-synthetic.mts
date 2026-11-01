/**
 * Skapar syntetiska elever och en syntetisk lärare i utvecklings-/test-/förhandsdatabaser.
 * Vägrar köra mot DB_TARGET=production. Uppgifterna är offentliga och syntetiska (se docs/OPERATIONS.md).
 */
import { SYNTHETIC, seedSynthetic } from "../src/server/services/synthetic";
import { getPool } from "../src/server/db";

if (!process.env.DB_TARGET || process.env.DB_TARGET === "production") {
  console.error("Sätt DB_TARGET till development, test eller preview. Syntetiska konton får inte skapas i produktion.");
  process.exit(2);
}
await seedSynthetic();
await getPool().end();
console.log("Syntetisk lärare:", SYNTHETIC.teacherEmail, "(lösenord och TOTP-hemlighet: se src/server/services/synthetic.ts)");
console.log(`Syntetiska elever: ${SYNTHETIC.studentUsername(1)} … ${SYNTHETIC.studentUsername(SYNTHETIC.studentCount)} (kod: ${SYNTHETIC.studentCode(1)} osv.)`);
