import { getContent } from "@/lib/content";
import { chapterPath, themePath } from "@/lib/chapters";
import { EducationNav, type NavTheme } from "./EducationNav";

export function navThemes(): NavTheme[] {
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

/** Gemensam layout för temaöversikter och kapitelsidor: navigationen (spalt/panel) plus innehållet. */
export function EducationShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-[78rem] gap-4 px-4 pt-6 sm:px-6 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-8 lg:pt-8">
      <EducationNav themes={navThemes()} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
