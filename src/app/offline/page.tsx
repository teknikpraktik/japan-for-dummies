import type { Metadata } from "next";
import Link from "next/link";
import { getContent } from "@/lib/content";
import { OfflinePanel } from "@/components/OfflinePanel";
import { InstallHelp } from "@/components/InstallHelp";
import { ResepassView } from "@/components/ResepassView";
import { ClearLocalData } from "@/components/ClearLocalData";
import { LocalNotice } from "@/components/LocalNotice";
import { UpdatePanel } from "@/components/UpdatePanel";

export const metadata: Metadata = { title: "Min utbildning" };

export default function OfflineAndProgress() {
  const { chapters, themes } = getContent();
  return (
    <div className="container-page space-y-8 pt-8">
      <header className="space-y-2">
        <h1>Min utbildning</h1>
        <p className="prose-col">Här laddar du ned utbildningen så att den fungerar utan internet, ser hur långt du har kommit och sparar eller rensar dina framsteg. Inget konto behövs.</p>
      </header>

      <UpdatePanel />
      <OfflinePanel />
      <InstallHelp />

      <section aria-labelledby="framsteg" className="space-y-4">
        <h2 id="framsteg">Dina framsteg</h2>
        <LocalNotice />
        <ResepassView
          themes={themes.map((t) => ({ id: t.id, order: t.order, title: t.title }))}
          chapters={chapters.map((c) => ({ id: c.id, slug: c.slug, themeId: c.themeId, status: c.status, title: c.title, minutes: c.status === "published" ? c.minutes : undefined }))}
        />
      </section>

      <ClearLocalData />

      <section aria-labelledby="uppdatering" className="card prose-col space-y-2">
        <h2 id="uppdatering">Uppdateringar</h2>
        <p>När nytt innehåll finns visas en ruta där du själv väljer när du vill uppdatera. Sidan laddas aldrig om av sig själv, och uppdateringar raderar inte dina framsteg. Läs mer under <Link href="/integritet/">Integritet</Link>.</p>
      </section>
    </div>
  );
}
