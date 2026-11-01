"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Start", icon: "⌂" },
  { href: "/utbildning/", label: "Utbildning", icon: "☰" },
  { href: "/resepass/", label: "Resepass", icon: "★" },
  { href: "/info/", label: "Info", icon: "ⓘ" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href.replace(/\/$/, "")) || (href === "/utbildning/" && pathname.startsWith("/kapitel"));
}

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="border-b border-line bg-card">
      <div className="container-page flex items-center justify-between gap-4 py-3">
        <Link href="/" className="flex items-center gap-2 no-underline" style={{ color: "var(--color-indigo-dark)" }}>
          <span aria-hidden="true" className="inline-block h-4 w-4 rounded-full bg-red" />
          <span className="font-serif text-xl font-bold">Japanresan 2027</span>
        </Link>
        <nav aria-label="Huvudmeny" className="hidden md:block">
          <ul className="flex gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(pathname, l.href) ? "page" : undefined}
                  className="inline-flex min-h-11 items-center rounded-lg px-3 font-semibold no-underline hover:bg-indigo-soft aria-[current=page]:bg-indigo aria-[current=page]:text-white"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

/** Nedre menyn på mobil, nåbar med tummen. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Snabbmeny" className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="grid grid-cols-4">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={isActive(pathname, l.href) ? "page" : undefined}
              className="flex min-h-16 flex-col items-center justify-center gap-0.5 text-sm font-semibold no-underline aria-[current=page]:bg-indigo-soft aria-[current=page]:text-indigo-dark"
            >
              <span aria-hidden="true" className="text-lg leading-none">{l.icon}</span>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
