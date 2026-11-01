/** Deterministisk slumpgenerator (mulberry32) så att samma seed ger samma ordning på server och klient. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const r = rng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Blandar men garanterar att resultatet inte blir samma ordning som indata (om möjligt). */
export function shuffleDifferent<T>(items: readonly T[], seed: number): T[] {
  if (items.length < 2) return [...items];
  let s = seed;
  for (let tries = 0; tries < 20; tries++, s++) {
    const out = seededShuffle(items, s);
    if (out.some((v, i) => v !== items[i])) return out;
  }
  return [...items].reverse();
}
