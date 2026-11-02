import { getContent } from "@/lib/content";
import { ChapterCard } from "./ChapterCard";

/** Huvudvyn: sammanfattning av elevens progression och det valda temat med alla dess kapitel. */
export function ThemeView({ themeId }: { themeId: string }) {
  const { themes, chapters } = getContent();
  const theme = themes.find((t) => t.id === themeId)!;
  const inTheme = chapters.filter((c) => c.themeId === themeId).sort((a, b) => a.order - b.order);
  return (
    <div className="space-y-5">
      <section aria-labelledby="tema-rubrik" className="space-y-4">
        <header className="space-y-1">
          <p className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            Tema {theme.order} av {themes.length}
          </p>
          <h1 id="tema-rubrik">{theme.title}</h1>
          <p className="prose-col text-ink-soft">{theme.description}</p>
        </header>
        <ol className="space-y-2.5" aria-label={`Kapitel i ${theme.title}`}>
          {inTheme.map((c) => (
            <ChapterCard key={c.id} chapter={c} />
          ))}
        </ol>
      </section>
    </div>
  );
}
