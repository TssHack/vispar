import { describe, expect, it } from 'vitest';

import { buildBackup, MAX_BACKUP_CHARS, mergeLibrary, parseBackup } from '@/lib/backup';
import type { Library } from '@/library/store';

const poster = (id: number, type: 'movie' | 'serie' = 'movie') => ({
  id,
  type,
  title: `عنوان ${id}`,
  image: 'i.jpg',
  cover: 'c.jpg',
  year: 2020,
  imdb: 7.1,
  genres: [{ id: 1, title: 'درام' }],
});

const lib = (over: Partial<Library> = {}): Library => ({ favorites: [], progress: {}, ...over });
const prog = (id: number, updatedAt: number, position = 100) => ({ key: `movie:${id}`, poster: poster(id), position, duration: 5000, updatedAt });

describe('library backup', () => {
  it('round-trips favorites and progress', () => {
    const l = lib({ favorites: [{ poster: poster(1), addedAt: 10 }], progress: { 'movie:2': prog(2, 20) } });
    const r = parseBackup(buildBackup(l));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.library.favorites).toEqual(l.favorites);
      expect(r.library.progress['movie:2']).toMatchObject({ position: 100, duration: 5000, updatedAt: 20 });
    }
  });

  it('rejects empty, huge, non-JSON, foreign JSON and other versions', () => {
    expect(parseBackup('  ')).toEqual({ ok: false, reason: 'empty' });
    expect(parseBackup('x'.repeat(MAX_BACKUP_CHARS + 1))).toEqual({ ok: false, reason: 'too-large' });
    expect(parseBackup('not json')).toEqual({ ok: false, reason: 'not-json' });
    expect(parseBackup('{"hello":1}')).toEqual({ ok: false, reason: 'not-backup' });
    expect(parseBackup('[1,2]')).toEqual({ ok: false, reason: 'not-backup' });
    expect(parseBackup(JSON.stringify({ app: 'vispar', kind: 'library', version: 99 }))).toEqual({ ok: false, reason: 'version' });
  });

  it('drops source URLs and unknown keys from untrusted input', () => {
    const evil = JSON.stringify({
      app: 'vispar',
      kind: 'library',
      version: 1,
      favorites: [{ poster: { ...poster(1), sources: [{ id: 1, quality: '1080', type: 'mp4', url: 'http://evil' }], __proto__: { x: 1 }, extra: 'y' }, addedAt: 5 }],
      progress: {},
    });
    const r = parseBackup(evil);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const p = r.library.favorites[0].poster as Record<string, unknown>;
      expect(p.sources).toBeUndefined();
      expect(p.extra).toBeUndefined();
    }
  });

  it('skips malformed entries instead of failing the whole file', () => {
    const r = parseBackup(
      JSON.stringify({
        app: 'vispar',
        kind: 'library',
        version: 1,
        favorites: [{ poster: poster(1), addedAt: 1 }, { poster: { id: 'x' } }, null, 7],
        progress: { a: { poster: poster(2), position: NaN, duration: 10 }, b: { poster: poster(3), position: 5, duration: 0 }, c: prog(4, 9) },
      }),
    );
    expect(r.ok && r.library.favorites).toHaveLength(1);
    expect(r.ok && Object.keys(r.library.progress)).toEqual(['c']);
  });

  it('merge adds missing items and never lowers newer local progress', () => {
    const mine = lib({ favorites: [{ poster: poster(1), addedAt: 50 }], progress: { 'movie:2': prog(2, 100, 900) } });
    const theirs = lib({
      favorites: [{ poster: poster(1), addedAt: 10 }, { poster: poster(3), addedAt: 20 }],
      progress: { 'movie:2': prog(2, 40, 10), 'movie:4': prog(4, 30) },
    });
    const m = mergeLibrary(mine, theirs);
    expect(m.addedFavorites).toBe(1);
    expect(m.addedProgress).toBe(1);
    expect(m.library.favorites.map((f) => f.poster.id)).toEqual([1, 3]);
    expect(m.library.progress['movie:2'].position).toBe(900);
  });

  it('merge is idempotent', () => {
    const a = lib({ favorites: [{ poster: poster(1), addedAt: 5 }], progress: { 'movie:2': prog(2, 7) } });
    const once = mergeLibrary(lib(), a).library;
    const twice = mergeLibrary(once, a);
    expect(twice.addedFavorites).toBe(0);
    expect(twice.addedProgress).toBe(0);
    expect(twice.library).toEqual(once);
  });

  it('merge keeps at most 300 progress entries, dropping the oldest', () => {
    const progress: Library['progress'] = {};
    for (let i = 0; i < 310; i++) progress[`movie:${i}`] = prog(i, i);
    const m = mergeLibrary(lib(), lib({ progress }));
    expect(Object.keys(m.library.progress)).toHaveLength(300);
    expect(m.library.progress['movie:0']).toBeUndefined();
    expect(m.library.progress['movie:309']).toBeDefined();
  });
});
