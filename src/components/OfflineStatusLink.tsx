"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { offlineLabel, useOfflineStatus } from "@/lib/offline-store";

/** Offlinestatus i sidhuvudet. Länkar till sidan med detaljer; visar samma status som övriga offlinekontroller. */
export function OfflineStatusLink() {
  const pathname = usePathname();
  const v = useOfflineStatus();
  if (v.kind === "unsupported") return null;
  const label = v.kind === "loading" ? "Ladda ned offline" : offlineLabel(v);
  return (
    <Link
      href="/offline/"
      aria-current={pathname.startsWith("/offline") ? "page" : undefined}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-[0.95rem] font-semibold no-underline hover:bg-indigo-soft aria-[current=page]:bg-indigo-soft"
      data-testid="offline-link"
    >
      <span aria-live="polite">{label}</span>
    </Link>
  );
}
