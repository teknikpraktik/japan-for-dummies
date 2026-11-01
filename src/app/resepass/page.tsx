import type { Metadata } from "next";
import { getContent } from "@/lib/content";
import { ResepassView } from "@/components/ResepassView";

export const metadata: Metadata = { title: "Ditt resepass" };

export default function Resepass() {
  const { chapters, themes } = getContent();
  return (
    <div className="container-page space-y-6 pt-8">
      <header className="space-y-2">
        <h1>Ditt resepass</h1>
        <p className="prose-col">Dina framsteg, bästa resultat och favoriter. Allt sparas lokalt på din enhet.</p>
      </header>
      <ResepassView
        themes={themes.map((t) => ({ id: t.id, order: t.order, title: t.title }))}
        chapters={chapters.map((c) => ({ id: c.id, slug: c.slug, themeId: c.themeId, status: c.status, title: c.title, minutes: c.status === "published" ? c.minutes : undefined }))}
      />
    </div>
  );
}
