"use client";

import Link from "next/link";
import { useAccount } from "./AccountProvider";

/** Visar innehåll endast för lärare. (Servern kontrollerar alltid; det här är bara gränssnittet.) */
export function TeacherGate({ children }: { children: React.ReactNode }) {
  const { status, user, unverified } = useAccount();
  if (status === "loading") return <p aria-busy="true">Hämtar…</p>;
  if (unverified) return <p className="feedback feedback-wrong prose-col" role="alert">Administrationen kräver internet. Anslut och försök igen.</p>;
  if (!user)
    return (
      <div className="card prose-col space-y-3">
        <p>Du måste logga in som lärare.</p>
        <Link className="btn btn-primary" href="/logga-in/">Logga in</Link>
      </div>
    );
  if (user.role !== "teacher") return <p className="feedback feedback-wrong prose-col" role="alert" data-testid="not-teacher">Den här sidan är bara för lärare.</p>;
  return <>{children}</>;
}

export function TeacherNav({ current }: { current: "oversikt" | "elever" | "larare" }) {
  const items = [
    { id: "oversikt", href: "/lararen/", label: "Översikt" },
    { id: "elever", href: "/lararen/elever/", label: "Elever" },
    { id: "larare", href: "/lararen/larare/", label: "Lärare" },
  ] as const;
  return (
    <nav aria-label="Läraradministration" className="flex flex-wrap gap-2">
      {items.map((i) => (
        <Link key={i.id} href={i.href} aria-current={current === i.id ? "page" : undefined} className="btn btn-small aria-[current=page]:bg-indigo aria-[current=page]:text-white">
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
