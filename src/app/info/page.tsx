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
          <li><strong>Som gäst</strong> sparas framstegen i webbläsaren på den här enheten. <strong>Med konto</strong> (som läraren skapar åt dig) synkas bara kapitelstatus till servern när du är online, så att din lärare kan se den. Se <Link href="/integritet/">Integritet</Link>.</li>
          <li>Som gäst <strong>synkas de inte</strong> mellan din telefon, surfplatta och dator. Med konto följer kapitelstatus med dig. På delade datorer sparas inget personligt kvar efter utloggning om du inte själv väljer det.</li>
          <li>De kan <strong>försvinna</strong> om du rensar webbdata eller historik, byter webbläsare, använder privat läge eller om enheten rensar utrymme.</li>
          <li><strong>Exportera</strong> framstegen då och då under <Link href="/resepass/#export">Resepass</Link>. Filen kan importeras igen, även på en annan enhet.</li>
          <li>Det som sparas: vilka kapitel du öppnat, bästa och senaste testresultat, favoriter, samt ditt pågående test så att svar inte försvinner om sidan laddas om. Inga namn eller personuppgifter.</li>
          <li>Som gäst skickas ingenting till någon annan. Med konto ser lärarna i din grupp vilka kapitel du påbörjat och avklarat, inte dina felaktiga svar. Offlineframsteg är en bekvämlighet och inte manipulationssäkert. Det finns ingen topplista.</li>
          <li>Inloggning och lärarsidor kräver internet och sparas aldrig för offlineanvändning.</li>
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
