import type { Source } from '@/api/types';

import { canPlayInApp, isTrailer, type PlayerPlatform } from './containers';
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
 * The candidates to choose from on `platform`.
 *
 * Without a platform nothing is filtered (the old behaviour). With one, a source the built-in player
 * cannot decode is only skipped when a **full-length** alternative that it can decode exists:
 * trailers never count as an alternative (the catalogue's MP4 files are mostly trailers, so
 * "prefer the playable one" would otherwise play the trailer instead of the film). When no full-length
 * file is playable the best full-length file is still returned, and `play()` then routes it to the
 * external-player chooser with an explanation instead of handing it to a decoder that will fail.
 */
function candidatesFor(sources: Source[], platform?: PlayerPlatform): Source[] {
  if (!platform) return sources;
  const full = sources.filter((s) => !isTrailer(s));
  if (!full.length) return sources; // trailers only: nothing else to offer
  const playable = full.filter((s) => canPlayInApp(s, platform));
  return playable.length ? playable : full;
}

/**
 * Source for the user's default quality: the exact resolution if present, otherwise the closest
 * one below it, otherwise the lowest above it. "best" means the highest available.
 * Pass `platform` to skip containers the built-in player cannot decode (see `candidatesFor`).
 */
export function pickSource(
  sources: Source[],
  pref: 'best' | '2160' | '1080' | '720' | '480' = 'best',
  opts: { platform?: PlayerPlatform } = {},
): Source | null {
  const sorted = sortSources(candidatesFor(sources, opts.platform));
  if (!sorted.length) return null;
  if (pref === 'best') return sorted[0];
  const target = Number(pref);
  const atOrBelow = sorted.find((s) => qualityRank(s.quality) > 0 && qualityRank(s.quality) <= target);
  return atOrBelow ?? sorted[sorted.length - 1];
}
