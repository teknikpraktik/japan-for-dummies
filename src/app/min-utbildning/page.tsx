import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ACCOUNTS_ENABLED } from "@/lib/features";
import { getContent } from "@/lib/content";
import { StudentHome } from "@/components/StudentHome";

export const metadata: Metadata = { title: "Min utbildning", robots: { index: false } };

export default function MyEducation() {
  if (!ACCOUNTS_ENABLED) notFound();
  const { chapters, themes } = getContent();
  return (
    <div className="container-page space-y-6 pt-8">
      <header className="space-y-2">
        <h1>Min utbildning</h1>
        <p className="prose-col">Dina kapitel, dina framsteg och ditt resepass.</p>
      </header>
      <StudentHome
        themes={themes.map((t) => ({ id: t.id, order: t.order, title: t.title }))}
        chapters={chapters.map((c) => ({ id: c.id, slug: c.slug, themeId: c.themeId, status: c.status, title: c.title, minutes: c.status === "published" ? c.minutes : undefined }))}
      />
    </div>
  );
}
