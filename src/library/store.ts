import type { ContentType, Poster } from '@/api/types';
import { createPersistedStore } from '@/lib/persist';

/** Enough of a poster to render cards and open its page without a network round trip. */
export type SavedPoster = Pick<Poster, 'id' | 'type' | 'title' | 'image' | 'cover' | 'year' | 'imdb' | 'genres'> &
  Partial<Pick<Poster, 'description' | 'rating' | 'duration' | 'country' | 'sources'>>;

export type EpisodeRef = { seasonIndex: number; episodeIndex: number; episodeId: number; title: string };

export type Progress = {
  key: string;
  poster: SavedPoster;
  episode?: EpisodeRef;
  position: number;
  duration: number;
  updatedAt: number;
};

type Library = {
  favorites: { poster: SavedPoster; addedAt: number }[];
  /** Keyed by progressKey(). One entry per movie and per episode. */
  progress: Record<string, Progress>;
};

const MAX_PROGRESS = 300;

export const libraryStore = createPersistedStore<Library>('vispar.library', { favorites: [], progress: {} }, (saved) => {
  const s = (saved ?? {}) as Partial<Library>;
  return { favorites: Array.isArray(s.favorites) ? s.favorites : [], progress: s.progress && typeof s.progress === 'object' ? s.progress : {} };
});

export function snapshot(p: Poster | SavedPoster): SavedPoster {
  return {
    id: p.id,
    type: p.type,
    title: p.title,
    image: p.image,
    cover: p.cover,
    year: p.year,
    imdb: p.imdb,
    genres: p.genres,
    description: p.description,
    rating: p.rating,
    duration: p.duration,
    country: p.country,
    sources: p.type === 'movie' ? p.sources : undefined,
  };
}

export const progressKey = (type: ContentType, id: number, episodeId?: number) => (episodeId ? `${type}:${id}:${episodeId}` : `${type}:${id}`);

// ---------- favorites ----------

export const isFavorite = (type: ContentType, id: number) =>
  libraryStore.get().favorites.some((f) => f.poster.type === type && f.poster.id === id);

export function toggleFavorite(p: Poster | SavedPoster): boolean {
  const on = isFavorite(p.type, p.id);
  libraryStore.set((l) => ({
    ...l,
    favorites: on
      ? l.favorites.filter((f) => !(f.poster.type === p.type && f.poster.id === p.id))
      : [{ poster: snapshot(p), addedAt: Date.now() }, ...l.favorites],
  }));
  return !on;
}

export const useIsFavorite = (type: ContentType, id: number) =>
  libraryStore.use((l) => l.favorites.some((f) => f.poster.type === type && f.poster.id === id));

export const useFavorites = () => libraryStore.use((l) => l.favorites);

export function clearFavorites() {
  libraryStore.set((l) => ({ ...l, favorites: [] }));
}

// ---------- progress ----------

/** Finished means within the last 5% or 2 minutes. */
export function isFinished(p: Pick<Progress, 'position' | 'duration'>) {
  return p.duration > 0 && (p.position >= p.duration * 0.95 || p.duration - p.position < 120);
}

/** Worth offering "resume": past the first 30s and not finished. */
export function canResume(p: Pick<Progress, 'position' | 'duration'> | undefined | null) {
  return !!p && p.position > 30 && !isFinished(p);
}

export function saveProgress(entry: Omit<Progress, 'key' | 'updatedAt'>) {
  if (!entry.duration || !Number.isFinite(entry.duration)) return;
  const key = progressKey(entry.poster.type, entry.poster.id, entry.episode?.episodeId);
  libraryStore.set((l) => {
    const progress = { ...l.progress, [key]: { ...entry, poster: snapshot(entry.poster), key, updatedAt: Date.now() } };
    const keys = Object.keys(progress);
    if (keys.length > MAX_PROGRESS) {
      keys
        .sort((a, b) => progress[a].updatedAt - progress[b].updatedAt)
        .slice(0, keys.length - MAX_PROGRESS)
        .forEach((k) => delete progress[k]);
    }
    return { ...l, progress };
  });
}

export const getProgress = (key: string) => libraryStore.get().progress[key] ?? null;
export const useProgressMap = () => libraryStore.use((l) => l.progress);

export function removeProgress(key: string) {
  libraryStore.set((l) => {
    const progress = { ...l.progress };
    delete progress[key];
    return { ...l, progress };
  });
}

export function clearHistory() {
  libraryStore.set((l) => ({ ...l, progress: {} }));
}

/**
 * "Continue watching": one row per title (latest episode for series), unfinished,
 * newest first.
 */
export function continueWatching(progress: Record<string, Progress>): Progress[] {
  const latest = new Map<string, Progress>();
  for (const p of Object.values(progress)) {
    const k = `${p.poster.type}:${p.poster.id}`;
    const cur = latest.get(k);
    if (!cur || p.updatedAt >= cur.updatedAt) latest.set(k, p);
  }
  return [...latest.values()].filter((p) => !isFinished(p) && p.position > 10).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function history(progress: Record<string, Progress>): Progress[] {
  return Object.values(progress).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Latest progress entry for a series (any episode). */
export function lastEpisodeOf(progress: Record<string, Progress>, seriesId: number): Progress | null {
  let best: Progress | null = null;
  for (const p of Object.values(progress)) {
    if (p.poster.type === 'serie' && p.poster.id === seriesId && p.episode && (!best || p.updatedAt >= best.updatedAt)) best = p;
  }
  return best;
}

/** Library lookup used when a detail page is opened cold (deep link, after restart). */
export function findSaved(type: ContentType, id: number): SavedPoster | null {
  const l = libraryStore.get();
  const fav = l.favorites.find((f) => f.poster.type === type && f.poster.id === id);
  if (fav) return fav.poster;
  for (const p of Object.values(l.progress)) if (p.poster.type === type && p.poster.id === id) return p.poster;
  return null;
}
