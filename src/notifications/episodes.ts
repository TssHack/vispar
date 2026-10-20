/** Pure helpers for "new episode" alerts (kept free of React Native so they can be unit tested). */

export type EpisodeCounts = Record<string, number>;

export type NewEpisodes = { id: number; added: number; total: number };

/**
 * Compares the episode counts seen last time with the current ones.
 * A series seen for the first time is only recorded, never announced.
 */
export function diffEpisodes(previous: EpisodeCounts, current: Record<number, number>): { fresh: NewEpisodes[]; next: EpisodeCounts } {
  const next: EpisodeCounts = { ...previous };
  const fresh: NewEpisodes[] = [];
  for (const [rawId, total] of Object.entries(current)) {
    const id = Number(rawId);
    const had = previous[rawId];
    if (had !== undefined && total > had) fresh.push({ id, added: total - had, total });
    // Never go backwards: a temporarily shorter list must not re-announce later.
    next[rawId] = Math.max(had ?? 0, total);
  }
  return { fresh, next };
}

/** Counts every episode across the seasons of one series. */
export function countEpisodes(seasons: { episodes: unknown[] }[]): number {
  return seasons.reduce((n, s) => n + s.episodes.length, 0);
}
