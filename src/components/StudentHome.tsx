"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { chapterStatus, suggestNext } from "@/lib/progress";
import { useProgress } from "@/lib/store";
import { flush, pull, useSyncStatus } from "@/lib/sync";
import { useAccount } from "./AccountProvider";
import { StatusBadge } from "./ChapterClient";
import type { ChapterLite } from "@/lib/chapter-lite";
import { LegacyImportPanel } from "./LegacyImportPanel";
import { ResepassView, type ThemeLite } from "./ResepassView";
import { PersistToggle } from "./PersistToggle";

export function StudentHome({ chapters, themes }: { chapters: ChapterLite[]; themes: ThemeLite[] }) {
  const { status, user, unverified } = useAccount();
  const { state, hydrated } = useProgress();
  const sync = useSyncStatus();
  const router = useRouter();
  useEffect(() => {
    if (status === "ready" && user?.role === "teacher") router.replace("/lararen/");
  }, [status, user, router]);

  if (status === "loading") return <p aria-busy="true">Hämtar din sida…</p>;
  if (!user)
    return (
      <div className="card prose-col space-y-3" data-testid="needs-login">
        <p>Du är inte inloggad. Logga in för att se din utbildning och dina framsteg.</p>
        <Link className="btn btn-primary" href="/logga-in/">Logga in</Link>
      </div>
    );
  if (user.role !== "student") return null;

  const published = chapters.filter((c) => c.status === "published");
  const next = hydrated ? (suggestNext(state, chapters) as ChapterLite | undefined) : undefined;
  const syncText =
    sync.status === "syncing" ? "Synkar…" : sync.status === "offline" ? `Offline: ${sync.pending} framsteg väntar på synkning` : sync.status === "expired" ? "Inloggningen har gått ut" : sync.status === "error" ? "Synkningen misslyckades, försöker igen" : sync.pending > 0 ? `${sync.pending} framsteg väntar på synkning` : "Allt är synkat";

  return (
    <div className="space-y-8">
      <section className="card flex flex-col gap-3" aria-labelledby="forts">
        <h2 id="forts">Hej {user.displayName}!</h2>
        {user.groupName && <p className="text-sm text-ink-soft">Grupp: {user.groupName}</p>}
        {next ? (
          <>
            <p>
              {chapterStatus(state, next.id) === "in-progress" ? "Du är mitt i:" : "Nästa föreslagna kapitel:"} <strong>{next.title}</strong>
            </p>
            <Link className="btn btn-primary self-start" href={`/kapitel/${next.slug}/`} data-testid="continue">
              {chapterStatus(state, next.id) === "in-progress" ? "Fortsätt kapitlet" : "Gå till kapitlet"}
            </Link>
          </>
        ) : (
          <p>Du har klarat alla kapitel.</p>
        )}
      </section>

      <section aria-labelledby="status" className="space-y-3">
        <h2 id="status">Dina kapitel</h2>
        <ul className="space-y-2">
          {published.map((c) => (
            <li key={c.id} className="card !p-3 flex flex-wrap items-center justify-between gap-2" data-testid={`chapter-row-${c.id}`}>
              <Link href={`/kapitel/${c.slug}/`}>{c.title}</Link>
              <StatusBadge chapterId={c.id} showUntouched />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="synk" className="card space-y-3">
        <h2 id="synk" className="!text-xl">Synkning</h2>
        <p data-testid="sync-status" role="status">
          {unverified ? "Offline: inloggningen kan inte bekräftas. " : ""}
          {syncText}
          {sync.lastSyncedAt ? `. Senast synkad ${new Date(sync.lastSyncedAt).toLocaleString("sv-SE")}.` : "."}
        </p>
        <button className="btn btn-small" onClick={() => void flush().then(pull)} disabled={unverified} data-testid="sync-now">
          Synka nu
        </button>
        <p className="text-sm text-ink-soft">
          Din lärare ser vilka kapitel du påbörjat och klarat och när du senast synkade. Inga svar, klick eller lästider sparas centralt. Framsteg du gör utan internet är en bekvämlighet för dig och är inte ett manipulationssäkert underlag. <Link href="/integritet/">Läs mer om integritet</Link>.
        </p>
      </section>

      <LegacyImportPanel userId={user.id} chapters={chapters} />
      <PersistToggle />
      <ResepassView chapters={chapters} themes={themes} showTransfer={false} />
    </div>
  );
}
