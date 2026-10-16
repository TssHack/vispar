import { config } from '@/config';

import { parsePosterList, parseReleases, parseSearch, parseSeasons } from './parse';
import type { GithubRelease, Poster, Season } from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Opts = { base?: string; key?: string; fetchImpl?: typeof fetch; timeoutMs?: number };

/**
 * Builds an upstream path. The upstream puts the key in the path (and is inconsistent about
 * trailing slashes), so `withKey` mirrors exactly what the Android app sends. In proxy mode
 * there is no key and the Worker appends it.
 */
export function buildUrl(segments: (string | number)[], opts: { trailingSlash?: boolean } & Opts = {}): string {
  const base = (opts.base ?? config.apiBase).replace(/\/+$/, '');
  const key = opts.key ?? config.apiKey;
  const parts = segments.map((s) => encodeURIComponent(String(s)));
  if (key) parts.push(encodeURIComponent(key));
  return `${base}/${parts.join('/')}${opts.trailingSlash ? '/' : ''}`;
}

export async function fetchJson(url: string, opts: Opts & { headers?: Record<string, string> } = {}): Promise<unknown> {
  const f = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? config.timeoutMs);
  try {
    const res = await f(url, { signal: ctrl.signal, headers: { Accept: 'application/json', ...opts.headers } });
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
    return await res.json();
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error)?.name === 'AbortError') throw new ApiError('timeout');
    throw new ApiError((e as Error)?.message ?? 'network');
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  movies: async (page: number, o?: Opts): Promise<Poster[]> =>
    parsePosterList(await fetchJson(buildUrl(['movie', 'by', 'filtres', 0, 'created', page], o), o), 'movie'),

  series: async (page: number, o?: Opts): Promise<Poster[]> =>
    parsePosterList(await fetchJson(buildUrl(['serie', 'by', 'filtres', 0, 'created', page], o), o), 'serie'),

  seasons: async (seriesId: number, o?: Opts): Promise<Season[]> =>
    parseSeasons(await fetchJson(buildUrl(['season', 'by', 'serie', seriesId], { ...o, trailingSlash: true }), o)),

  search: async (query: string, o?: Opts): Promise<Poster[]> => {
    const q = query.trim();
    if (!q) return [];
    return parseSearch(await fetchJson(buildUrl(['search', q], { ...o, trailingSlash: true }), o));
  },

  releases: async (o?: Opts): Promise<GithubRelease[]> =>
    parseReleases(
      await fetchJson(`https://api.github.com/repos/${config.githubRepo}/releases?per_page=10`, {
        ...o,
        // GitHub requires a User-Agent; browsers set their own and forbid overriding it.
        headers: typeof navigator !== 'undefined' && navigator.product !== 'ReactNative' ? {} : { 'User-Agent': 'vispar-App' },
      }),
    ),
};
