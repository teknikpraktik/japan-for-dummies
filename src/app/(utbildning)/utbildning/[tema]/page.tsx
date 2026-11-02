import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContent } from "@/lib/content";
import { ThemeView } from "@/components/ThemeView";

export const dynamicParams = false;

export function generateStaticParams() {
  return getContent().themes.map((t) => ({ tema: t.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ tema: string }> }): Promise<Metadata> {
  const { tema } = await params;
  const t = getContent().themes.find((x) => x.id === tema);
  return { title: t ? `Tema ${t.order}: ${t.title}` : "Utbildning" };
}

export default async function ThemePage({ params }: { params: Promise<{ tema: string }> }) {
  const { tema } = await params;
  if (!getContent().themes.some((t) => t.id === tema)) notFound();
  return <ThemeView themeId={tema} />;
}
