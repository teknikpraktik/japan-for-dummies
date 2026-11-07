import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { Block } from "@/lib/schema";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/content", () => ({ getContent: () => ({ photos: [] }) }));

import { Blocks } from "@/components/Blocks";

describe("Blocks: enkel markering i alla textblock", () => {
  it("tidslinje och faktarutor visar fet och kursiv text i stället för asterisker", () => {
    const blocks: Block[] = [
      { type: "timeline", items: [{ when: "Januari", text: "**Nyår** är den största högtiden, *shōgatsu*." }, { when: "Juli", text: "**Obon**" }] },
      { type: "facts", items: [{ label: "Torii", value: "Porten in, med **två** pelare." }] },
    ];
    const { container } = render(<Blocks blocks={blocks} media={[]} />);
    expect(container.textContent).not.toContain("*");
    expect(container.querySelectorAll("strong").length).toBe(3);
    expect(container.querySelectorAll("em").length).toBe(1);
  });
  it("ingen råtext med ** finns kvar i något kapitels listor, faktarutor eller tidslinjer", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), "src", "content", "chapters");
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      for (const s of d.sections) for (const b of s.blocks) if (b.type === "timeline" || b.type === "facts") {
        const { container } = render(<Blocks blocks={[b]} media={[]} />);
        expect(container.textContent, `${d.id} ${s.id}`).not.toMatch(/\*/);
      }
    }
  });
});
