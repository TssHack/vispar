import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => {
  const mem = new Map<string, string>();
  return {
    default: {
      getItem: async (k: string) => mem.get(k) ?? null,
      setItem: async (k: string, v: string) => void mem.set(k, v),
    },
  };
});

import type { Poster, Source } from '@/api/types';
import { androidPackages, m3uPlaylist } from '@/external/apps';
import { activeCount, applyFilters, EMPTY_FILTERS, optionsFrom } from '@/filters/filters';
import { canResume, continueWatching, isFinished, libraryStore, saveProgress, toggleFavorite, isFavorite } from '@/library/store';
import { faClock, faNum, setDigitStyle } from '@/lib/format';
import { pickSource } from '@/lib/sources';
import { DEFAULT_SETTINGS, migrateSettings } from '@/settings/store';

const poster = (o: Partial<Poster>): Poster => ({
  id: 1,
  type: 'movie',
  title: 'X',
  description: '',
  year: 2020,
  imdb: 7,
  rating: 0,
  duration: null,
  image: '',
  cover: '',
  genres: [],
  country: [],
  sources: [],
  ...o,
});
const src = (quality: string, type = 'mp4'): Source => ({ id: 0, quality, type, url: `https://x/${quality}.${type}` });

describe('filters', () => {
  const items = [
    poster({ id: 1, title: 'ب', year: 2024, imdb: 8.2, genres: [{ id: 1, title: 'درام' }], country: [{ id: 1, title: 'ایران', image: '' }], sources: [src('1080p')] }),
    poster({ id: 2, title: 'الف', year: 1998, imdb: 6.1, genres: [{ id: 2, title: 'اکشن' }], sources: [src('480p')] }),
    poster({ id: 3, title: 'پ', year: 2021, imdb: 7.4, genres: [{ id: 1, title: 'درام' }, { id: 2, title: 'اکشن' }], sources: [src('2160p')] }),
  ];

  it('combines genre, decade, rating and quality', () => {
    expect(applyFilters(items, { ...EMPTY_FILTERS, genres: ['درام'] }).map((p) => p.id)).toEqual([1, 3]);
    expect(applyFilters(items, { ...EMPTY_FILTERS, decades: [2020] }).map((p) => p.id)).toEqual([1, 3]);
    expect(applyFilters(items, { ...EMPTY_FILTERS, minImdb: 7 }).map((p) => p.id)).toEqual([1, 3]);
    expect(applyFilters(items, { ...EMPTY_FILTERS, quality: '2160' }).map((p) => p.id)).toEqual([3]);
    expect(applyFilters(items, { ...EMPTY_FILTERS, countries: ['ایران'] }).map((p) => p.id)).toEqual([1]);
  });

  it('sorts without mutating the source list', () => {
    expect(applyFilters(items, { ...EMPTY_FILTERS, sort: 'imdb' }).map((p) => p.id)).toEqual([1, 3, 2]);
    expect(applyFilters(items, { ...EMPTY_FILTERS, sort: 'yearAsc' }).map((p) => p.id)).toEqual([2, 3, 1]);
    expect(items.map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it('derives options and counts active filters', () => {
    const o = optionsFrom(items);
    expect(o.genres[0]).toBe('درام');
    expect(o.decades).toEqual([2020, 1990]);
    expect(activeCount({ ...EMPTY_FILTERS, genres: ['a'], minImdb: 7, sort: 'imdb' })).toBe(2);
  });
});

describe('default quality', () => {
  const list = [src('480p'), src('1080p'), src('720p', 'm3u8'), src('720p')];
  it('picks the exact match, then the closest lower, then the lowest', () => {
    expect(pickSource(list, 'best')?.quality).toBe('1080p');
    expect(pickSource(list, '720')?.type).toBe('mp4');
    expect(pickSource(list, '2160')?.quality).toBe('1080p');
    expect(pickSource([src('1080p')], '480')?.quality).toBe('1080p');
    expect(pickSource([], 'best')).toBeNull();
  });
});

describe('settings migration', () => {
  it('keeps defaults for missing keys and maps the old external player flag', () => {
    const s = migrateSettings({ externalPlayer: true, home: { genres: false } });
    expect(s.playerMode).toBe('ask');
    expect(s.home.genres).toBe(false);
    expect(s.home.movies).toBe(true);
    expect(s.accent).toBe('amber');
  });
  it('rejects invalid values', () => {
    expect(migrateSettings({ skipSeconds: 7 }).skipSeconds).toBe(10);
    expect(migrateSettings(null).density).toBe('normal');
  });
});

describe('library', () => {
  beforeEach(() => libraryStore.set({ favorites: [], progress: {} }));

  it('toggles favorites', () => {
    const p = poster({ id: 5 });
    expect(toggleFavorite(p)).toBe(true);
    expect(isFavorite('movie', 5)).toBe(true);
    expect(toggleFavorite(p)).toBe(false);
    expect(isFavorite('movie', 5)).toBe(false);
  });

  it('knows when something is finished or resumable', () => {
    expect(isFinished({ position: 5800, duration: 6000 })).toBe(true);
    expect(canResume({ position: 20, duration: 6000 })).toBe(false);
    expect(canResume({ position: 1200, duration: 6000 })).toBe(true);
  });

  it('keeps one continue-watching row per series, newest episode', () => {
    const show = poster({ id: 9, type: 'serie' });
    saveProgress({ poster: show, episode: { seasonIndex: 0, episodeIndex: 0, episodeId: 1, title: 'a' }, position: 600, duration: 3000 });
    saveProgress({ poster: show, episode: { seasonIndex: 0, episodeIndex: 1, episodeId: 2, title: 'b' }, position: 300, duration: 3000 });
    saveProgress({ poster: poster({ id: 3 }), position: 5990, duration: 6000 });
    const rows = continueWatching(libraryStore.get().progress);
    expect(rows).toHaveLength(1);
    expect(rows[0].episode?.episodeId).toBe(2);
  });
});

describe('external apps', () => {
  it('declares every Android package in the manifest plugin', () => {
    const require = createRequire(import.meta.url);
    const plugin = require('../plugins/withExternalApps.js');
    expect([...plugin.PACKAGES].sort()).toEqual([...androidPackages].sort());
  });
  it('writes a one-item m3u playlist', () => {
    expect(m3uPlaylist('https://x/a.mp4', 'فیلم\nتست')).toBe('#EXTM3U\n#EXTINF:-1,فیلم تست\nhttps://x/a.mp4\n');
  });
});

describe('digits and clock', () => {
  it('formats time and honours the digit setting', () => {
    expect(faClock(3725)).toBe('۱:۰۲:۰۵');
    setDigitStyle('en');
    expect(faNum('۲۰۲۶ و 8.1')).toBe('2026 و 8.1');
    expect(faClock(65)).toBe('01:05');
    setDigitStyle('fa');
  });
});


describe('settings migration (v2.1 options)', () => {
  it('fills new options for settings saved by older versions', () => {
    const s = migrateSettings({ accent: 'teal' });
    expect(s.accent).toBe('teal');
    expect(s.videoFit).toBe('contain');
    expect(s.heroAuto).toBe(true);
    expect(s.notifyNewContent).toBe(false);
  });
  it('rejects an unknown video fit', () => {
    expect(migrateSettings({ videoFit: 'zoom' }).videoFit).toBe(DEFAULT_SETTINGS.videoFit);
  });
});

import { explainPlaybackError } from '@/lib/playbackError';

describe('explainPlaybackError', () => {
  it('names the usual causes', () => {
    expect(explainPlaybackError('CLEARTEXT communication to x not permitted').title).toMatch(/HTTP/);
    expect(explainPlaybackError('java.net.SocketTimeoutException: timeout').title).toMatch(/سرور/);
    expect(explainPlaybackError('Response code: 403').title).toMatch(/اجازه/);
    expect(explainPlaybackError('Response code: 404').title).toMatch(/پیدا نشد/);
    expect(explainPlaybackError('MediaCodecVideoRenderer error, format=hevc').title).toMatch(/کدک/);
    expect(explainPlaybackError(undefined).title).toMatch(/ممکن نشد/);
  });
});

import { androidIntentUrl } from '@/external/apps';

describe('androidIntentUrl', () => {
  it('builds an intent that opens the file in a named app, with a Play Store fallback', () => {
    const u = androidIntentUrl('http://host.example/film1/a%20b.mkv?x=1', { pkg: 'org.videolan.vlc', title: 'Film' });
    expect(u.startsWith('intent://host.example/film1/a%20b.mkv?x=1#Intent;')).toBe(true);
    expect(u).toContain('scheme=http;');
    expect(u).toContain('package=org.videolan.vlc');
    expect(u).toContain('type=video/*');
    expect(u).toContain('S.browser_fallback_url=');
    expect(u.endsWith(';end')).toBe(true);
  });
  it('omits the package for the system chooser', () => {
    expect(androidIntentUrl('https://h/x.mp4')).not.toContain('package=');
  });
});
