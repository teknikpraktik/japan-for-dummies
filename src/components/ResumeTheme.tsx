"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { readLastTheme } from "@/lib/last-theme";
import { themePath } from "@/lib/chapters";

/**
 * /utbildning/ utan tema: skickar vidare till senast besökta tema, annars tema 1. Inget tema ritas innan
 * valet är gjort, så fel tema blinkar aldrig till. Explicita temalänkar går direkt till sin sida.
 */
export function ResumeTheme({ themeIds }: { themeIds: string[] }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(themePath(readLastTheme(themeIds) ?? themeIds[0]));
  }, [router, themeIds]);
  return (
    <div aria-busy="true" aria-live="polite" className="min-h-[60vh]">
      <p className="text-ink-soft">Öppnar utbildningen…</p>
      <noscript>
        <p>
          <Link href={themePath(themeIds[0])}>Öppna tema 1</Link>
        </p>
      </noscript>
    </div>
  );
}
