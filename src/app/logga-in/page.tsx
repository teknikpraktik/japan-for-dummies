import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Logga in", robots: { index: false } };

export default function LoginPage() {
  return (
    <div className="container-page space-y-6 pt-8">
      <header className="space-y-2">
        <h1>Logga in</h1>
        <p className="prose-col">Välj om du är elev eller lärare. Inloggning kräver internet. Utbildningens kapitel kan läsas utan att logga in.</p>
      </header>
      <LoginForm />
    </div>
  );
}
