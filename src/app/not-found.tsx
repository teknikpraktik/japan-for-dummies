import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page space-y-4 pt-8">
      <h1>Sidan kunde inte hittas</h1>
      <p className="prose-col">Adressen finns inte. Gå tillbaka till översikten och välj ett kapitel därifrån.</p>
      <p className="flex gap-2">
        <Link className="btn btn-primary" href="/utbildning/">Till översikten</Link>
        <Link className="btn" href="/">Till startsidan</Link>
      </p>
    </div>
  );
}
