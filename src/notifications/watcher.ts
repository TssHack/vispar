import { AppState, Platform } from 'react-native';

import { api } from '@/api/client';
import type { Poster } from '@/api/types';
import { faNum } from '@/lib/format';
import { createPersistedStore } from '@/lib/persist';
import { settingsStore } from '@/settings/store';

import { notifyLocal } from '.';

type Seen = { movie: number[]; serie: number[]; lastCheck: number; seeded: boolean };

const seenStore = createPersistedStore<Seen>('vispar.notify', { movie: [], serie: [], lastCheck: 0, seeded: false });

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

let started = false;
/** Checks at launch, whenever the app returns to the foreground, and every half hour while open. */
export function startContentWatcher() {
  if (started || Platform.isTV) return;
  started = true;
  void checkNewContent();
  AppState.addEventListener('change', (s) => {
    if (s === 'active') void checkNewContent();
  });
  setInterval(() => void checkNewContent(), MIN_GAP);
}
