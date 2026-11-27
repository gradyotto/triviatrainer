import { SCORING } from "@/config/scoring";

export type DailyCandidate = {
  id: string;
  categorySlug: string;
  difficulty: string;
};

type Band = "easy" | "medium" | "hard";

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function bandOf(difficulty: string): Band | null {
  const key = difficulty.trim().toLowerCase();
  if (key === "easy" || key === "medium" || key === "hard") return key;
  return null;
}

export function difficultyQuotas(count: number): Record<Band, number> {
  const size = Math.max(0, count);
  const base = Math.floor(size / 3);
  const remainder = size % 3;
  return {
    easy: base + (remainder > 1 ? 1 : 0),
    medium: base + (remainder > 0 ? 1 : 0),
    hard: base,
  };
}

function seededShuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swap] as T;
    copy[swap] = current as T;
  }
  return copy;
}

function categoryCounts(picked: DailyCandidate[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of picked) {
    counts.set(item.categorySlug, (counts.get(item.categorySlug) ?? 0) + 1);
  }
  return counts;
}

function take(
  pool: DailyCandidate[],
  picked: DailyCandidate[],
  pickedIds: Set<string>,
  random: () => number,
  want: number,
  band: Band | null,
) {
  if (want <= 0) return;
  const ordered = seededShuffle(
    pool.filter((item) => {
      if (pickedIds.has(item.id)) return false;
      if (!band) return true;
      return bandOf(item.difficulty) === band;
    }),
    random,
  );
  let remaining = want;
  while (remaining > 0) {
    const counts = categoryCounts(picked);
    let bestIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let index = 0; index < ordered.length; index += 1) {
      const candidate = ordered[index];
      if (!candidate || pickedIds.has(candidate.id)) continue;
      const score = counts.get(candidate.categorySlug) ?? 0;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    if (bestIndex < 0) return;
    const chosen = ordered[bestIndex];
    if (!chosen) return;
    picked.push(chosen);
    pickedIds.add(chosen.id);
    remaining -= 1;
  }
}

/**
 * Deterministic daily set for one game date.
 * The length comes from `SCORING.questionCount` unless the caller passes `count`
 * (stored challenges keep the length they were created with).
 * Fresh questions are preferred over anything used inside the repeat window.
 * Input order does not matter.
 */
export function selectDailyQuestionIds(input: {
  gameDate: string;
  candidates: readonly DailyCandidate[];
  recentlyUsedIds?: readonly string[];
  count?: number;
}): string[] {
  const count = input.count ?? SCORING.questionCount;
  const recent = new Set(input.recentlyUsedIds ?? []);
  const unique = new Map<string, DailyCandidate>();
  for (const candidate of input.candidates) {
    if (!unique.has(candidate.id)) unique.set(candidate.id, candidate);
  }
  const all = [...unique.values()].sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );
  if (all.length === 0 || count <= 0) return [];

  const random = mulberry32(hashSeed(`daily:${input.gameDate}`));
  const fresh = all.filter((item) => !recent.has(item.id));
  const stale = all.filter((item) => recent.has(item.id));
  const picked: DailyCandidate[] = [];
  const pickedIds = new Set<string>();
  const quotas = difficultyQuotas(Math.min(count, all.length));
  const bands: Band[] = ["easy", "medium", "hard"];

  for (const band of bands) {
    take(fresh, picked, pickedIds, random, quotas[band], band);
  }
  take(fresh, picked, pickedIds, random, count - picked.length, null);
  if (picked.length < count) {
    for (const band of bands) {
      const have = picked.filter((item) => bandOf(item.difficulty) === band).length;
      take(stale, picked, pickedIds, random, quotas[band] - have, band);
    }
    take(stale, picked, pickedIds, random, count - picked.length, null);
  }

  return picked.slice(0, count).map((item) => item.id);
}
