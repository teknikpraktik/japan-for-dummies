import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ACCOUNTS_ENABLED } from "@/lib/features";
import { AccountPage } from "@/components/AccountPage";

export const metadata: Metadata = { title: "Konto", robots: { index: false } };

export default function Konto() {
  if (!ACCOUNTS_ENABLED) notFound();
  return (
    <div className="container-page space-y-6 pt-8">
      <h1>Konto</h1>
      <AccountPage />
    </div>
  );
}
