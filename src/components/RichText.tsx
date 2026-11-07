import { Fragment } from "react";
import Link from "next/link";

/**
 * Mycket begränsad inline-markering: **fet**, *kursiv* och interna länkar [text](/sökväg/).
 * Länkar får bara peka på sidor i den egna webbplatsen (börja med en enkel snedstreck). All övrig text renderas som ren text (ingen HTML).
 */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(\/[^)\s]*\))/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
        const link = /^\[([^\]]+)\]\((\/[^)\s]*)\)$/.exec(p);
        if (link && !link[2].startsWith("//")) return <Link key={i} href={link[2]}>{link[1]}</Link>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}
