import type { Source } from '@/api/types';

import { isStreamOnly, qualityRank } from './format';

/** Highest resolution first; at equal resolution, direct files before HLS streams. */
export function sortSources(sources: Source[]): Source[] {
  return [...sources].sort((a, b) => {
    const r = qualityRank(b.quality) - qualityRank(a.quality);
    if (r !== 0) return r;
    return Number(isStreamOnly(a)) - Number(isStreamOnly(b));
  });
}

export const bestSource = (sources: Source[]): Source | null => sortSources(sources)[0] ?? null;

/**
 * Source for the user's default quality: the exact resolution if present, otherwise the closest
 * one below it, otherwise the lowest above it. "best" means the highest available.
 */
export function pickSource(sources: Source[], pref: 'best' | '2160' | '1080' | '720' | '480' = 'best'): Source | null {
  const sorted = sortSources(sources);
  if (!sorted.length) return null;
  if (pref === 'best') return sorted[0];
  const target = Number(pref);
  const atOrBelow = sorted.find((s) => qualityRank(s.quality) > 0 && qualityRank(s.quality) <= target);
  return atOrBelow ?? sorted[sorted.length - 1];
}
