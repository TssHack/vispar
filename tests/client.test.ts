import { describe, expect, it, vi } from 'vitest';

vi.mock('@/config', () => ({
  config: { apiBase: 'https://hostinnegar.com/api', apiKey: '', timeoutMs: 1000, githubRepo: 'tsshack/vispar' },
}));

import { ApiError, api, buildUrl } from '@/api/client';
import { faNum, faScore, isStreamOnly, qualityRank } from '@/lib/format';
import { sortSources } from '@/lib/sources';

const KEY = 'TESTKEY';
const BASE = 'https://hostinnegar.com/api';

describe('upstream URLs (direct mode, same paths as the Android app)', () => {
  it('lists have no trailing slash', () => {
    expect(buildUrl(['movie', 'by', 'filtres', 0, 'created', 2], { base: BASE, key: KEY })).toBe(`${BASE}/movie/by/filtres/0/created/2/${KEY}`);
  });
  it('seasons and search end with a slash and encode the query', () => {
    expect(buildUrl(['season', 'by', 'serie', 42], { base: BASE, key: KEY, trailingSlash: true })).toBe(`${BASE}/season/by/serie/42/${KEY}/`);
    expect(buildUrl(['search', 'breaking bad'], { base: BASE, key: KEY, trailingSlash: true })).toBe(`${BASE}/search/breaking%20bad/${KEY}/`);
    expect(buildUrl(['search', 'فیلم'], { base: BASE, key: KEY, trailingSlash: true })).toContain('/search/%D9%81%DB%8C%D9%84%D9%85/');
  });
  it('proxy mode sends no key', () => {
    expect(buildUrl(['serie', 'by', 'filtres', 0, 'created', 0], { base: 'https://proxy.dev/', key: '' })).toBe('https://proxy.dev/serie/by/filtres/0/created/0');
  });
});

describe('client errors', () => {
  it('turns non-2xx into ApiError with the status', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 403 })) as unknown as typeof fetch;
    await expect(api.movies(0, { fetchImpl, base: BASE, key: KEY })).rejects.toMatchObject({ name: 'ApiError', status: 403 });
  });
  it('parses a successful page', async () => {
    const fetchImpl = vi.fn(async () => Response.json([{ id: 1, title: 'A', type: 'movie' }])) as unknown as typeof fetch;
    const items = await api.movies(0, { fetchImpl, base: BASE, key: KEY });
    expect(items[0].title).toBe('A');
    expect(ApiError).toBeDefined();
  });
  it('skips the request for an empty search', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    expect(await api.search('   ', { fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('formatting and sources', () => {
  it('uses Persian digits and decimal separator', () => {
    expect(faNum('2026')).toBe('۲۰۲۶');
    expect(faScore(8.1)).toBe('۸٫۱');
    expect(faScore(0)).toBe('');
  });
  it('sorts by resolution, files before HLS', () => {
    const s = sortSources([
      { id: 1, quality: '480p', type: 'mp4', url: 'a.mp4' },
      { id: 2, quality: '1080p', type: 'm3u8', url: 'b.m3u8' },
      { id: 3, quality: '1080p', type: 'mp4', url: 'c.mp4' },
    ]);
    expect(s.map((x) => x.id)).toEqual([3, 2, 1]);
    expect(isStreamOnly(s[1])).toBe(true);
    expect(qualityRank('4K')).toBe(2160);
  });
});
