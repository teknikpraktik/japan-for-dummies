import type { Metadata } from "next";
import { ActivateForm } from "@/components/ActivateForm";

export const metadata: Metadata = { title: "Aktivera lärarkonto", robots: { index: false } };

export default function Activate() {
  return (
    <div className="container-page space-y-6 pt-8">
      <header className="space-y-2">
        <h1>Aktivera ditt lärarkonto</h1>
        <p className="prose-col">Välj ett eget lösenord. Därefter loggar du in. Länken fungerar bara en gång.</p>
      </header>
      <ActivateForm />
    </div>
  );
}
