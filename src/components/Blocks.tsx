import type { Block, Media } from "@/lib/schema";
import { RichText } from "./RichText";
import { PhotoSlot } from "./Photo";

const toneLabel = { info: "Bra att veta", care: "Visa hänsyn", check: "Tänk på" } as const;

export function Blocks({ blocks, media }: { blocks: Block[]; media: Media[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "p":
            return (
              <p key={i}>
                <RichText text={b.text} />
              </p>
            );
          case "list": {
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag key={i} className={`${b.ordered ? "list-decimal" : "list-disc"} space-y-1.5 pl-6`}>
                {b.items.map((it, j) => (
                  <li key={j}>
                    <RichText text={it} />
                  </li>
                ))}
              </Tag>
            );
          }
          case "callout":
            return (
              <aside key={i} className={`callout callout-${b.tone}`}>
                <p className="font-bold">
                  <span className="text-xs uppercase tracking-wide opacity-80">{toneLabel[b.tone]}</span>
                  <br />
                  {b.title}
                </p>
                <p className="mt-1">
                  <RichText text={b.text} />
                </p>
              </aside>
            );
          case "phrases":
            return (
              <ul key={i} className="grid gap-3 sm:grid-cols-2" aria-label="Japanska uttryck">
                {b.items.map((it, j) => (
                  <li key={j} className="card !p-3">
                    <p lang="ja" className="text-2xl font-semibold leading-snug">
                      {it.jp}
                    </p>
                    <p className="font-semibold text-indigo-dark">
                      <span className="sr-only">Romaji: </span>
                      <i>{it.romaji}</i>
                    </p>
                    <p>
                      <span className="sr-only">Betyder: </span>
                      {it.sv}
                    </p>
                    {it.tip && <p className="mt-1 text-sm text-ink-soft">Uttalstips/notis: {it.tip}</p>}
                  </li>
                ))}
              </ul>
            );
          case "facts":
            return (
              <dl key={i} className="card grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
                {b.items.map((it, j) => (
                  <div key={j} className="contents">
                    <dt className="font-semibold text-indigo-dark"><RichText text={it.label} /></dt>
                    <dd><RichText text={it.value} /></dd>
                  </div>
                ))}
              </dl>
            );
          case "timeline":
            return (
              <ol key={i} className="space-y-0 border-l-2 border-indigo/40 pl-4">
                {b.items.map((it, j) => (
                  <li key={j} className="relative pb-3">
                    <span aria-hidden="true" className="absolute -left-[1.4rem] top-2 h-2.5 w-2.5 rounded-full bg-red" />
                    <span className="font-bold text-indigo-dark"><RichText text={it.when} /></span>
                    <span className="block sm:inline sm:before:content-['_–_']"><RichText text={it.text} /></span>
                  </li>
                ))}
              </ol>
            );
          case "photo":
            return <PhotoSlot key={i} role="figure" slotId={b.slotId} imageId={b.imageId} brief={b.brief} />;
          case "observe":
            return (
              <aside key={i} className="card space-y-3 !bg-indigo-soft" aria-label={`Observationsuppgift: ${b.title}`} data-testid="observe">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-ink-soft">Observationsuppgift</p>
                  <h3>{b.title}</h3>
                </div>
                <p>
                  <RichText text={b.prompt} />
                </p>
                <ol className="list-decimal space-y-1 pl-6">
                  {b.steps.map((st, j) => (
                    <li key={j}>
                      <RichText text={st} />
                    </li>
                  ))}
                </ol>
              </aside>
            );
          case "figure": {
            const m = media.find((x) => x.id === b.mediaId);
            if (!m) return null;
            return (
              <figure key={i} className="card !p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.src} alt={m.alt} width={m.width} height={m.height} className="mx-auto h-auto max-h-[28rem] w-full max-w-md rounded-lg" loading="lazy" />
                <figcaption className="mt-2 text-sm text-ink-soft">
                  {m.caption}
                </figcaption>
              </figure>
            );
          }
        }
      })}
    </div>
  );
}
