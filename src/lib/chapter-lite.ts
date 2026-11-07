import type { ChapterRef } from "@/lib/progress";

export interface ChapterLite extends ChapterRef {
  slug: string;
  title: string;
  minutes?: number;
}
