import type { Metadata } from "next";
import { getContent } from "@/lib/content";
import { ResumeTheme } from "@/components/ResumeTheme";

export const metadata: Metadata = { title: "Utbildning" };

export default function Overview() {
  const ids = getContent().themes.slice().sort((a, b) => a.order - b.order).map((t) => t.id);
  return <ResumeTheme themeIds={ids} />;
}
