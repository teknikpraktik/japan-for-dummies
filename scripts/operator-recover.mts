/**
 * Operatörsrutin när den enda läraren förlorat både inloggning och återställningskoder.
 * Kräver direkt databasåtkomst (ingen HTTP-väg, ingen bakdörr).
 *
 *   npm run admin:recover -- --email <lärarens adress> [--new-password] [--reset-2fa] [--password-stdin] --yes
 *
 * --new-password  sätter nytt lösenord (läses dolt/stdin/RECOVER_TEACHER_PASSWORD, aldrig som parameter)
 * --reset-2fa     tar bort registrerad tvåfaktor och återställningskoder (läraren registrerar ny vid inloggning)
 * Alla sessioner för kontot avslutas och åtgärden loggas i säkerhetsloggen (utan hemligheter).
 */
import { operatorResetTeacher } from "../src/server/services/bootstrap";
import { getPool } from "../src/server/db";
import { readSecret } from "./_secret";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const i = args.indexOf("--email");
const email = i >= 0 ? args[i + 1] : undefined;
if (!email || !flag("yes") || (!flag("new-password") && !flag("reset-2fa"))) {
  console.error("Användning: npm run admin:recover -- --email <adress> [--new-password] [--reset-2fa] --yes");
  process.exit(2);
}
process.env.DB_TARGET ??= "development";
if (process.env.DB_TARGET === "production" && process.env.CONFIRM_OPERATOR_ACTION !== "yes") {
  console.error("DB_TARGET=production: sätt CONFIRM_OPERATOR_ACTION=yes för att bekräfta.");
  process.exit(2);
}
let newPassword: string | undefined;
if (flag("new-password")) {
  newPassword = await readSecret("Nytt lösenord (minst 12 tecken, visas inte): ", { fromStdin: flag("password-stdin"), envVar: "RECOVER_TEACHER_PASSWORD" });
  if (newPassword.length < 12 || newPassword.length > 128) {
    console.error("Lösenordet ska vara 12–128 tecken.");
    process.exit(2);
  }
}
const res = await operatorResetTeacher({ email, newPassword, reset2fa: flag("reset-2fa") });
await getPool().end();
console.log(res.status === "done" ? "Klart. Sessionerna är avslutade. Läraren loggar in och registrerar tvåfaktor på nytt om den återställdes." : `Ingen ändring: ${res.status}`);
process.exit(res.status === "done" ? 0 : 1);
