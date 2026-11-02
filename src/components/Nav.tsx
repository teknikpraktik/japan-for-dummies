"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "./AccountProvider";
import { AccountMenu } from "./AccountMenu";
import { OfflineStatusLink } from "./OfflineStatusLink";
import { ACCOUNTS_ENABLED } from "@/lib/features";

const links = [
  { href: "/", label: "Startsida", icon: "⌂" },
  { href: "/utbildning/", label: "Utbildning", icon: "☰" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href.replace(/\/$/, "")) || (href === "/utbildning/" && pathname.startsWith("/kapitel"));
}

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="border-b border-line bg-card">
      <div className="container-page flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
        <Link href="/" className="flex items-center gap-2 no-underline" style={{ color: "var(--color-indigo-dark)" }}>
          <span aria-hidden="true" className="inline-block h-4 w-4 rounded-full bg-red" />
          <span className="font-serif text-xl font-bold">Japan for Dummies</span>
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
        <div className="flex items-center gap-1">
          <OfflineStatusLink />
          {ACCOUNTS_ENABLED && <AccountMenu />}
        </div>
      </div>
    </header>
  );
}

/** Nedre menyn på mobil, nåbar med tummen. */
export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAccount();
  const mine = !user ? { href: "/logga-in/", label: "Logga in", icon: "⎆" } : user.role === "teacher" ? { href: "/lararen/", label: "Lärare", icon: "☑" } : { href: "/min-utbildning/", label: "Min sida", icon: "★" };
  const items = ACCOUNTS_ENABLED ? [links[0], links[1], mine] : [links[0], links[1]];
  return (
    <nav aria-label="Snabbmeny" className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul className={ACCOUNTS_ENABLED ? "grid grid-cols-3" : "grid grid-cols-2"}>
        {items.map((l) => (
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
