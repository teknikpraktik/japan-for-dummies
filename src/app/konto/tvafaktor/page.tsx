import type { Metadata } from "next";
import { TwoFactorSetup } from "@/components/TwoFactorSetup";

export const metadata: Metadata = { title: "Registrera tvåfaktor", robots: { index: false } };

export default function TwoFactorPage() {
  return (
    <div className="container-page space-y-6 pt-8">
      <h1>Registrera tvåfaktor</h1>
      <TwoFactorSetup />
    </div>
  );
}
