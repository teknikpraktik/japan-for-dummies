/**
 * Engångskommando för att skapa första läraren (operatör med databasåtkomst).
 *
 *   npm run admin:bootstrap -- --email per.a.bjorkman@gmail.com [--name "Per"] [--password-stdin] [--allow-additional]
 *
 * Lösenordet läses ALDRIG från en kommandoradsparameter. Det läses (i ordning) från miljövariabeln
 * BOOTSTRAP_TEACHER_PASSWORD, från stdin (--password-stdin eller när stdin inte är en terminal), eller
 * som dolt tangentbordsinmatning. Det skrivs aldrig ut. Säkert att köra igen: ett befintligt konto ändras inte.
 * Kontot får administratörsåtkomst först när tvåfaktor (TOTP) har registrerats och verifierats vid första inloggningen.
 */
import { bootstrapFirstTeacher } from "../src/server/services/bootstrap";
import { getPool } from "../src/server/db";
import { readSecret } from "./_secret";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const value = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

if (args.some((a) => /password(?!-stdin)/.test(a) && a.startsWith("--") && a !== "--password-stdin")) {
  console.error("Lösenord får inte anges som parameter. Använd dolt inmatning, stdin eller BOOTSTRAP_TEACHER_PASSWORD.");
  process.exit(2);
}
const email = value("email");
if (!email) {
  console.error('Ange --email <adress>. Exempel: npm run admin:bootstrap -- --email namn@example.org');
  process.exit(2);
}
process.env.DB_TARGET ??= "development";
if (process.env.DB_TARGET === "production" && process.env.CONFIRM_OPERATOR_ACTION !== "yes") {
  console.error("DB_TARGET=production: sätt CONFIRM_OPERATOR_ACTION=yes för att bekräfta att du kör mot produktion.");
  process.exit(2);
}

const password = await readSecret("Nytt lösenord för läraren (minst 12 tecken, visas inte): ", { fromStdin: flag("password-stdin"), envVar: "BOOTSTRAP_TEACHER_PASSWORD" });
const res = await bootstrapFirstTeacher({ email, password, displayName: value("name"), allowAdditional: flag("allow-additional") });
await getPool().end();
if (res.status === "created") console.log("Läraren skapades. Logga in med e-postadressen och lösenordet.");
else if (res.status === "exists") console.log("Kontot finns redan. Inget ändrades (lösenord och roller är orörda).");
else {
  console.error(`Avbröt: ${res.reason}`);
  process.exit(1);
}
