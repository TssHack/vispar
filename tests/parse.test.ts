import { describe, expect, it } from 'vitest';

import { parsePosterList, parseRelease, parseSearch, parseSeasons } from '@/api/parse';

describe('poster parsing', () => {
  it('defaults missing fields like the Android app', () => {
    const [p] = parsePosterList([{ id: 7, title: 'X' }], 'movie');
    expect(p).toMatchObject({ id: 7, type: 'movie', title: 'X', description: '', year: 0, imdb: 0, duration: null, genres: [], sources: [] });
  });

  it('treats "null" and "N/A" durations as absent', () => {
    const items = parsePosterList(
      [
        { id: 1, duration: 'null' },
        { id: 2, duration: 'N/A' },
        { id: 3, duration: '128 min' },
      ],
      'movie',
    );
    expect(items.map((i) => i.duration)).toEqual([null, null, '128 min']);
  });

  it('skips items that are not objects or have no id, instead of failing the page', () => {
    const items = parsePosterList([null, 'junk', { title: 'no id' }, { id: '5', imdb: '8.1' }], 'serie');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 5, imdb: 8.1, type: 'serie' });
  });

  it('keeps the type from the payload and drops sources without a url', () => {
    const [p] = parsePosterList(
      [{ id: 9, type: 'serie', sources: [{ id: 1, quality: '720p', type: 'mp4', url: '' }, { id: 2, quality: '1080p', type: 'mp4', url: 'https://x/a.mp4' }] }],
      'movie',
    );
    expect(p.type).toBe('serie');
    expect(p.sources).toEqual([{ id: 2, quality: '1080p', type: 'mp4', url: 'https://x/a.mp4' }]);
  });

  it('returns an empty list for non-array payloads', () => {
    expect(parsePosterList({ error: 'bad key' }, 'movie')).toEqual([]);
  });
});

describe('search and seasons', () => {
  it('reads results from the posters wrapper', () => {
    const r = parseSearch({ posters: [{ id: 1, type: 'movie', title: 'A' }, { id: 2, type: 'serie', title: 'B' }] });
    expect(r.map((x) => x.type)).toEqual(['movie', 'serie']);
  });

  it('parses seasons with episodes and their sources', () => {
    const [s] = parseSeasons([{ id: 1, title: 'فصل ۱', episodes: [{ id: 10, title: 'E1', sources: [{ id: 1, quality: '480p', type: 'm3u8', url: 'https://x/e.m3u8' }] }] }]);
    expect(s.episodes[0].sources[0].type).toBe('m3u8');
  });
});

describe('github release', () => {
  it('finds the attached apk', () => {
    const r = parseRelease({
      tag_name: 'v2.1.0',
      html_url: 'https://github.com/tsshack/vispar/releases/tag/v2.1.0',
      assets: [{ name: 'notes.txt' }, { name: 'Vispar-2.1.0.APK', browser_download_url: 'https://dl/app.apk', size: 1048576 }],
    });
    expect(r).toMatchObject({ tagName: 'v2.1.0', apkUrl: 'https://dl/app.apk', apkSize: 1048576, prerelease: false });
  });
});
