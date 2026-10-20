import { AppState, Platform } from 'react-native';

import { api } from '@/api/client';
import type { Poster } from '@/api/types';
import { libraryStore } from '@/library/store';
import { faNum } from '@/lib/format';
import { createPersistedStore } from '@/lib/persist';
import { settingsStore } from '@/settings/store';

import { notifyLocal } from '.';
import { countEpisodes, diffEpisodes, type EpisodeCounts } from './episodes';

type Seen = { movie: number[]; serie: number[]; lastCheck: number; seeded: boolean; episodes: EpisodeCounts; lastEpisodeCheck: number };

const seenStore = createPersistedStore<Seen>('vispar.notify', { movie: [], serie: [], lastCheck: 0, seeded: false, episodes: {}, lastEpisodeCheck: 0 });

const MIN_GAP = 30 * 60_000;
const KEEP = 80;

const titles = (items: Poster[]) =>
  items
    .slice(0, 3)
    .map((p) => p.title)
    .join('، ');

/**
 * Looks at the newest page of movies and series and tells the user about titles it has not seen.
 * The very first run only records what exists, so installing the app never fires a flood.
 */
export async function checkNewContent(force = false): Promise<number> {
  await Promise.all([seenStore.ready, settingsStore.ready]);
  if (!settingsStore.get().notifyNewContent) return 0;
  const seen = seenStore.get();
  if (!force && Date.now() - seen.lastCheck < MIN_GAP) return 0;

  let movies: Poster[] = [];
  let series: Poster[] = [];
  try {
    [movies, series] = await Promise.all([api.movies(0), api.series(0)]);
  } catch {
    return 0;
  }

  const freshMovies = movies.filter((p) => !seen.movie.includes(p.id));
  const freshSeries = series.filter((p) => !seen.serie.includes(p.id));
  seenStore.set({
    ...seenStore.get(),
    movie: [...new Set([...movies.map((p) => p.id), ...seen.movie])].slice(0, KEEP),
    serie: [...new Set([...series.map((p) => p.id), ...seen.serie])].slice(0, KEEP),
    lastCheck: Date.now(),
    seeded: true,
  });
  if (!seen.seeded) return 0;

  const total = freshMovies.length + freshSeries.length;
  if (!total) return 0;
  const parts: string[] = [];
  if (freshMovies.length) parts.push(`${faNum(freshMovies.length)} فیلم`);
  if (freshSeries.length) parts.push(`${faNum(freshSeries.length)} سریال`);
  const lead = freshMovies.length >= freshSeries.length ? freshMovies : freshSeries;
  await notifyLocal({
    title: `${parts.join(' و ')} جدید در ویسپار`,
    body: titles([...freshMovies, ...freshSeries]),
    url: lead[0] ? `/${lead[0].type === 'movie' ? 'movie' : 'series'}/${lead[0].id}` : '/',
  });
  return total;
}

const MAX_WATCHED = 8;

/**
 * Tells the user when a series in "my list" (or one they are watching) gets new episodes.
 * Only the first few series are checked each time, and the first look just records the count.
 */
export async function checkNewEpisodes(force = false): Promise<number> {
  await Promise.all([seenStore.ready, settingsStore.ready, libraryStore.ready]);
  if (!settingsStore.get().notifyEpisodes) return 0;
  const seen = seenStore.get();
  if (!force && Date.now() - seen.lastEpisodeCheck < MIN_GAP) return 0;

  const lib = libraryStore.get();
  const ids = new Map<number, string>();
  for (const f of lib.favorites) if (f.poster.type === 'serie') ids.set(f.poster.id, f.poster.title);
  for (const p of Object.values(lib.progress)) if (p.poster.type === 'serie' && !ids.has(p.poster.id)) ids.set(p.poster.id, p.poster.title);
  const watched = [...ids.entries()].slice(0, MAX_WATCHED);
  if (!watched.length) return 0;

  const counts: Record<number, number> = {};
  await Promise.all(
    watched.map(async ([id]) => {
      try {
        counts[id] = countEpisodes(await api.seasons(id));
      } catch {
        // skip this series for now; it is checked again next time
      }
    }),
  );
  const { fresh, next } = diffEpisodes(seen.episodes ?? {}, counts);
  seenStore.set({ ...seenStore.get(), episodes: next, lastEpisodeCheck: Date.now() });

  for (const f of fresh) {
    const title = ids.get(f.id) ?? 'سریال';
    await notifyLocal({
      title: `قسمت جدید «${title}»`,
      body: `${faNum(f.added)} قسمت جدید اضافه شد؛ حالا ${faNum(f.total)} قسمت دارد.`,
      url: `/series/${f.id}`,
    });
  }
  return fresh.length;
}

let started = false;
/** Checks at launch, whenever the app returns to the foreground, and every half hour while open. */
export function startContentWatcher() {
  if (started || Platform.isTV) return;
  started = true;
  const all = () => {
    void checkNewContent();
    void checkNewEpisodes();
  };
  all();
  AppState.addEventListener('change', (s) => {
    if (s === 'active') all();
  });
  setInterval(all, MIN_GAP);
}
