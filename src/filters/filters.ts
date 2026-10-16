import type { Poster } from '@/api/types';
import { qualityRank } from '@/lib/format';

export type SortKey = 'newest' | 'imdb' | 'yearDesc' | 'yearAsc' | 'title';
export type QualityFilter = '2160' | '1080' | '720';

export type Filters = {
  genres: string[];
  countries: string[];
  /** Decade start, e.g. 2020 for 2020–2029. */
  decades: number[];
  minImdb: 0 | 6 | 7 | 8 | 9;
  /** Movies only: has at least this resolution. */
  quality: QualityFilter | null;
  sort: SortKey;
};

export const EMPTY_FILTERS: Filters = { genres: [], countries: [], decades: [], minImdb: 0, quality: null, sort: 'newest' };

export const SORT_LABELS: Record<SortKey, string> = {
  newest: 'تازه‌ترین',
  imdb: 'بیشترین امتیاز IMDb',
  yearDesc: 'جدیدترین سال',
  yearAsc: 'قدیمی‌ترین سال',
  title: 'الفبایی',
};

/** Number of active filters (sort doesn't count). */
export function activeCount(f: Filters): number {
  return f.genres.length + f.countries.length + f.decades.length + (f.minImdb ? 1 : 0) + (f.quality ? 1 : 0);
}

export const decadeOf = (year: number) => (year > 0 ? Math.floor(year / 10) * 10 : 0);

export function matches(p: Poster, f: Filters): boolean {
  if (f.genres.length && !p.genres.some((g) => f.genres.includes(g.title))) return false;
  if (f.countries.length && !p.country.some((c) => f.countries.includes(c.title))) return false;
  if (f.decades.length && !f.decades.includes(decadeOf(p.year))) return false;
  if (f.minImdb && !(p.imdb >= f.minImdb)) return false;
  if (f.quality) {
    if (p.type !== 'movie') return true; // series carry sources per episode
    const need = Number(f.quality);
    if (!p.sources.some((s) => qualityRank(s.quality) >= need)) return false;
  }
  return true;
}

const collator = typeof Intl !== 'undefined' ? new Intl.Collator('fa') : null;

/** `items` arrive newest-first from the API, so "newest" keeps their order. */
export function applyFilters(items: Poster[], f: Filters): Poster[] {
  const out = items.filter((p) => matches(p, f));
  switch (f.sort) {
    case 'imdb':
      return out.sort((a, b) => b.imdb - a.imdb);
    case 'yearDesc':
      return out.sort((a, b) => b.year - a.year);
    case 'yearAsc':
      return out.sort((a, b) => (a.year || 9999) - (b.year || 9999));
    case 'title':
      return out.sort((a, b) => (collator ? collator.compare(a.title, b.title) : a.title.localeCompare(b.title)));
    default:
      return out;
  }
}

export type FilterOptions = { genres: string[]; countries: string[]; decades: number[] };

/** Filter choices come from what has been loaded, most common first. */
export function optionsFrom(items: Poster[]): FilterOptions {
  const g = new Map<string, number>();
  const c = new Map<string, number>();
  const d = new Set<number>();
  for (const p of items) {
    for (const x of p.genres) if (x.title) g.set(x.title, (g.get(x.title) ?? 0) + 1);
    for (const x of p.country) if (x.title) c.set(x.title, (c.get(x.title) ?? 0) + 1);
    const dec = decadeOf(p.year);
    if (dec) d.add(dec);
  }
  const byCount = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  return { genres: byCount(g), countries: byCount(c), decades: [...d].sort((a, b) => b - a) };
}

export const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
