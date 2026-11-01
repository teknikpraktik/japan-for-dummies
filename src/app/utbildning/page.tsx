import type { Metadata } from "next";
import { getContent } from "@/lib/content";
import { EducationShell } from "@/components/EducationShell";

export const metadata: Metadata = { title: "Utbildning" };

/** Första besöket: tema 1. Övriga teman har egna adresser (/utbildning/<tema>/). */
export default function Overview() {
  const first = getContent().themes.slice().sort((a, b) => a.order - b.order)[0];
  return <EducationShell themeId={first.id} />;
}
