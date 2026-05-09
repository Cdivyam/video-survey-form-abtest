const SLOT_LABELS = ["A", "B", "C", "D", "E"] as const;
export type SlotLabel = (typeof SLOT_LABELS)[number];

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Returns { A: videoId, B: videoId, ... } for the given video IDs
export function buildSlotMap(videoIds: string[]): Record<SlotLabel, string> {
  const labels = SLOT_LABELS.slice(0, videoIds.length);
  const shuffled = shuffle(videoIds);
  return Object.fromEntries(
    labels.map((label, i) => [label, shuffled[i]])
  ) as Record<SlotLabel, string>;
}

// Weighted random selection: items with lower completionCount are preferred
export function weightedSample<T extends { id: string; completionCount: number }>(
  items: T[],
  k: number
): T[] {
  if (k >= items.length) return [...items];
  const selected: T[] = [];
  const pool = [...items];
  for (let i = 0; i < k; i++) {
    const maxCount = Math.max(...pool.map((x) => x.completionCount));
    const weights = pool.map((x) => maxCount - x.completionCount + 1);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let j = 0; j < weights.length; j++) {
      r -= weights[j];
      if (r <= 0) { idx = j; break; }
    }
    selected.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return selected;
}
