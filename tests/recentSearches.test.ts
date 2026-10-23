import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async () => null, setItem: async () => undefined } }));

import { addRecent, EMPTY_RECENT, MAX_RECENT, migrateRecent, normalizeSearch, removeRecent } from '@/lib/recentSearches';

describe('recent searches', () => {
  it('puts the newest first and moves a repeat to the front', () => {
    let l: readonly string[] = [];
    l = addRecent(l, 'آواتار');
    l = addRecent(l, 'مرد عنکبوتی');
    l = addRecent(l, 'آواتار');
    expect(l).toEqual(['آواتار', 'مرد عنکبوتی']);
  });

  it('treats Arabic ye/kaf and extra spaces as the same search', () => {
    expect(normalizeSearch('  كيمياگر   ')).toBe('کیمیاگر');
    const l = addRecent(['کیمیاگر'], 'كيمياگر ');
    expect(l).toEqual(['کیمیاگر']);
  });

  it('ignores queries shorter than two characters and returns the same array', () => {
    const l = ['الف ب'];
    expect(addRecent(l, ' ا ')).toBe(l);
  });

  it('caps the list', () => {
    let l: readonly string[] = [];
    for (let i = 0; i < 20; i++) l = addRecent(l, `فیلم ${i}`);
    expect(l).toHaveLength(MAX_RECENT);
    expect(l[0]).toBe('فیلم 19');
  });

  it('removes one entry, and returns the same array when nothing matches', () => {
    const l = ['الف ب', 'ج د'];
    expect(removeRecent(l, 'الف ب')).toEqual(['ج د']);
    expect(removeRecent(l, 'نیست')).toBe(l);
  });

  it('migrates junk safely and keeps order', () => {
    expect(migrateRecent(null)).toBe(EMPTY_RECENT);
    expect(migrateRecent({ list: 5 })).toBe(EMPTY_RECENT);
    expect(migrateRecent(['اول', 3, 'دوم'])).toEqual(['اول', 'دوم']);
  });

  it('selector value for an empty store is one shared frozen array', async () => {
    const { recentStore } = await import('@/search/store');
    expect(recentStore.get()).toBe(EMPTY_RECENT);
    expect(Object.isFrozen(recentStore.get())).toBe(true);
  });
});
