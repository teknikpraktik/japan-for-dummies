import type { Metadata } from "next";
import { getContent } from "@/lib/content";
import { OfflinePanel } from "@/components/OfflinePanel";
import { InstallHelp } from "@/components/InstallHelp";
import { MyProgress } from "@/components/MyProgress";
import { ManageStorage } from "@/components/ClearLocalData";
import { TransferPanel } from "@/components/TransferPanel";
import { UpdatePanel } from "@/components/UpdatePanel";

export const metadata: Metadata = { title: "Mina framsteg" };

export default function MyProgressPage() {
  const { chapters, themes } = getContent();
  return (
    <div className="container-page space-y-6 pt-8">
      <header className="space-y-1">
        <h1>Mina framsteg</h1>
        <p className="prose-col">Här ser du dina framsteg och fortsätter där du slutade.</p>
      </header>

      <UpdatePanel />

      <MyProgress
        themes={themes.slice().sort((a, b) => a.order - b.order).map((t) => ({ id: t.id, order: t.order, title: t.title }))}
        chapters={chapters.map((c) => ({ id: c.id, slug: c.slug, themeId: c.themeId, status: c.status, title: c.title, minutes: c.status === "published" ? c.minutes : undefined }))}
      />

      <OfflinePanel />

      <div className="space-y-2">
        <InstallHelp />
        <details className="tool" id="export">
          <summary>Säkerhetskopiera eller flytta framsteg</summary>
          <div className="pt-2">
            <TransferPanel />
          </div>
        </details>
        <details className="tool" id="lagring">
          <summary>Hantera lagring</summary>
          <div className="pt-2">
            <ManageStorage />
          </div>
        </details>
      </div>

      <p className="text-sm text-ink-soft" data-testid="local-notice">
        Dina framsteg sparas i den här webbläsaren. Exportera dem om du vill spara en kopia eller flytta dem till en annan enhet.
      </p>
    </div>
  );
}
