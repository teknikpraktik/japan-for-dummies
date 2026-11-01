import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper-2 py-6 text-sm text-ink-soft">
      <div className="container-page flex flex-col gap-2 md:flex-row md:justify-between">
        <p>Japanresan 2027 – förberedelse inför skolresa. Piloten har 6 färdiga kapitel av 60 planerade.</p>
        <p>
          <Link href="/integritet/">Integritet</Link> · <Link href="/kallor/">Källor</Link> · <Link href="/bildkallor/">Bildkällor</Link> · <Link href="/info/">Så sparas dina framsteg</Link>
        </p>
      </div>
    </footer>
  );
}
