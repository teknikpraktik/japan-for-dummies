import { getContent } from "@/lib/content";
import { chapterPath, themePath } from "@/lib/chapters";
import { EducationNav, type NavTheme } from "./EducationNav";
import { ThemeView } from "./ThemeView";

function navThemes(): NavTheme[] {
  const { themes, chapters } = getContent();
  return themes
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((t) => ({
      id: t.id,
      order: t.order,
      title: t.title,
      href: themePath(t.id),
      chapters: chapters
        .filter((c) => c.themeId === t.id)
        .sort((a, b) => a.order - b.order)
        .map((c) => ({ id: c.id, title: c.title, order: c.order, published: c.status === "published", href: chapterPath(c) })),
    }));
}

/** Vänsterspalt (eller panel på mobil) plus huvudvy för ett tema. Allt härleds ur innehållet. */
export function EducationShell({ themeId }: { themeId: string }) {
  return (
    <div className="mx-auto grid w-full max-w-[78rem] gap-4 px-4 pt-6 sm:px-6 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-8 lg:pt-8">
      <EducationNav themes={navThemes()} activeThemeId={themeId} />
      <div className="min-w-0">
        <ThemeView themeId={themeId} />
      </div>
    </div>
  );
}
