import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { findSaved, type SavedPoster } from '@/library/store';

import { api } from './client';
import type { ContentType, Poster } from './types';

/**
 * The API has no "get by id" endpoint, so detail screens read the item from what the lists and
 * search already loaded. Every fetched poster is remembered here.
 */
const known = new Map<string, Poster>();
const keyOf = (type: ContentType, id: number) => `${type}:${id}`;
const remember = (items: Poster[]) => {
  for (const p of items) known.set(keyOf(p.type, p.id), p);
  return items;
};
export const findPoster = (type: ContentType, id: number) => known.get(keyOf(type, id)) ?? null;

/** Library snapshots lack a few list fields; fill them so screens can treat them as posters. */
export function fromSaved(s: SavedPoster): Poster {
  return { description: '', rating: 0, duration: null, country: [], sources: [], ...s } as Poster;
}

/** Everything currently known: list pages, search results and the library. */
export function knownPosters(): Poster[] {
  return [...known.values()];
}

const PAGE_HINT = 10;

function usePaged(type: ContentType) {
  return useInfiniteQuery({
    queryKey: [type, 'list'],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => remember(type === 'movie' ? await api.movies(pageParam) : await api.series(pageParam)),
    // The API gives no total; stop when a page comes back empty.
    getNextPageParam: (last, _all, lastParam) => (last.length === 0 ? undefined : lastParam + 1),
    staleTime: 5 * 60_000,
  });
}

export const useMovies = () => usePaged('movie');
export const useSeries = () => usePaged('serie');

export function flatten(pages: Poster[][] | undefined): Poster[] {
  if (!pages) return [];
  const seen = new Set<string>();
  const out: Poster[] = [];
  for (const page of pages)
    for (const p of page) {
      const k = keyOf(p.type, p.id);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(p);
      }
    }
  return out;
}

export function useSeasons(seriesId: number | null) {
  return useQuery({
    queryKey: ['serie', seriesId, 'seasons'],
    enabled: !!seriesId,
    queryFn: () => api.seasons(seriesId as number),
    staleTime: 10 * 60_000,
  });
}

export function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useSearch(query: string) {
  const q = useDebounced(query.trim());
  return useQuery({
    queryKey: ['search', q],
    enabled: q.length >= 2,
    queryFn: async () => remember(await api.search(q)),
    staleTime: 60_000,
  });
}

/** Detail lookup: cached item first; if a deep link lands cold, try a few list pages. */
export function usePoster(type: ContentType, id: number) {
  const saved = findSaved(type, id);
  const found = findPoster(type, id) ?? (saved ? fromSaved(saved) : null);
  // A restored backup carries no source URLs; a movie without them cannot play, so fetch it fresh.
  const cached = found && type === 'movie' && found.sources.length === 0 ? null : found;
  return useQuery({
    queryKey: [type, id, 'detail'],
    initialData: cached ?? undefined,
    enabled: !cached && !!id,
    queryFn: async () => {
      for (let page = 0; page < PAGE_HINT; page++) {
        const items = remember(type === 'movie' ? await api.movies(page) : await api.series(page));
        const hit = items.find((p) => p.id === id);
        if (hit) return hit;
        if (items.length === 0) break;
      }
      return null;
    },
    staleTime: Infinity,
  });
}
