"use client";

import Link from "next/link";
import { clearNotices, useSyncStatus } from "@/lib/sync";
import { useAccount } from "./AccountProvider";

/** Begripliga meddelanden om inloggning och synkning. */
export function AccountBanner() {
  const { status, user, unverified } = useAccount();
  const sync = useSyncStatus();
  const items: { key: string; tone: "warn" | "info"; node: React.ReactNode }[] = [];

  if (unverified && user) {
    items.push({
      key: "unverified",
      tone: "warn",
      node: <>Du är offline och inloggningen kan inte bekräftas. Du arbetar med framsteg som sparats på den här enheten, och de synkas när du är online och inloggad. Inloggning och administration kräver internet.</>,
    });
  }
  if (user && !unverified && user.role === "student" && sync.status === "expired") {
    items.push({
      key: "expired",
      tone: "warn",
      node: (
        <>
          Din inloggning har gått ut, eller kontot har avaktiverats eller fått ny kod. Dina framsteg på den här enheten är kvar men synkas inte förrän du <Link href="/logga-in/">loggar in igen</Link>.
        </>
      ),
    });
  }
  if (user && !unverified && user.role === "teacher" && user.enrollmentRequired) {
    items.push({
      key: "enroll",
      tone: "warn",
      node: (
        <>
          Du måste registrera tvåfaktorsinloggning innan du får administratörsåtkomst. <Link href="/konto/tvafaktor/">Registrera nu</Link>.
        </>
      ),
    });
  }
  if (user?.role === "student" && sync.notices.length > 0) {
    items.push({
      key: "notices",
      tone: "info",
      node: (
        <>
          {sync.notices.join(" ")}{" "}
          <button className="underline" onClick={() => clearNotices()}>
            Dölj
          </button>
        </>
      ),
    });
  }
  if (status === "loading" || items.length === 0) return null;
  return (
    <div role="status" className="border-b border-[#e7cf8f] bg-warn-soft" data-testid="account-banner">
      <div className="container-page space-y-1 py-3 text-sm">
        {items.map((i) => (
          <p key={i.key}>{i.node}</p>
        ))}
      </div>
    </div>
  );
}
