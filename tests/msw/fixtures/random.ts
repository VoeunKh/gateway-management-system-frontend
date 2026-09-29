/** Seeded PRNG (mulberry32) so fixtures are identical on every run. */
export function seeded(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(items: readonly T[]): T => {
    const item = items[int(0, items.length - 1)];
    if (item === undefined) throw new Error('pick() from an empty list');
    return item;
  };
  return { next, int, pick };
}

export const FIXTURE_NOW = Date.parse('2026-09-29T08:00:00Z');

export const minutesAgo = (minutes: number) =>
  new Date(FIXTURE_NOW - minutes * 60_000).toISOString();

export const hex = (rand: () => number, length: number) =>
  Array.from({ length }, () => Math.floor(rand() * 16).toString(16)).join('');
