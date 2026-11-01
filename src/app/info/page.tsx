import type { Metadata } from "next";
import Link from "next/link";
import { OfflinePanel } from "@/components/OfflinePanel";
import { InstallHelp } from "@/components/InstallHelp";

export const metadata: Metadata = { title: "Info: lagring, offline och installation" };

export default function Info() {
  return (
    <div className="container-page space-y-8 pt-8">
      <header className="space-y-2">
        <h1>Info: lagring, offline och installation</h1>
      </header>

      <section aria-labelledby="lagring" className="card prose-col space-y-3">
        <h2 id="lagring">Så sparas dina framsteg</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>Framstegen sparas <strong>i webbläsaren på den här enheten</strong>. Det finns inga konton, ingen server och ingen databas.</li>
          <li>De <strong>synkas inte</strong> mellan din telefon, surfplatta och dator. Varje webbläsare har sina egna framsteg.</li>
          <li>De kan <strong>försvinna</strong> om du rensar webbdata eller historik, byter webbläsare, använder privat läge eller om enheten rensar utrymme.</li>
          <li><strong>Exportera</strong> framstegen då och då under <Link href="/resepass/#export">Resepass</Link>. Filen kan importeras igen, även på en annan enhet.</li>
          <li>Det som sparas: vilka kapitel du öppnat, bästa och senaste testresultat, favoriter, samt ditt pågående test så att svar inte försvinner om sidan laddas om. Inga namn eller personuppgifter.</li>
          <li>Ingenting skickas till någon annan, och ingen kan se dina resultat. Det finns ingen topplista.</li>
        </ul>
      </section>

      <OfflinePanel />
      <InstallHelp />

      <section aria-labelledby="uppdatering" className="card prose-col space-y-2">
        <h2 id="uppdatering">Uppdateringar</h2>
        <p>När ett nytt innehåll finns visas en ruta där du själv väljer när du vill uppdatera. Sidan laddas aldrig om av sig själv, och uppdateringar raderar inte dina framsteg.</p>
      </section>
    </div>
  );
}
