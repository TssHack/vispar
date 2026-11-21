import { parseDescription } from '@/lib/description';

/** Texts for the browser title, description and canonical (#62). Pure, so it is unit tested. */

const SITE = 'ویسپار';

export type PageMeta = {
  /** Shown before " | ویسپار". Null leaves the site name alone. */
  title: string | null;
  description?: string;
  /** Path for the canonical, e.g. `/movie/12`. Null removes the canonical (search, player). */
  path: string | null;
};

/** The full document title for a screen. */
export const documentTitle = (title: string | null): string => (title ? `${title} | ${SITE}` : SITE);

/** Pure: title, description and path for a film or series page, from what the app already loaded. */
export function posterPageMeta(poster: { id: number; title: string; year?: number | null; description?: string | null } | null | undefined, type: 'movie' | 'serie'): PageMeta {
  const path = `/${type === 'serie' ? 'series' : 'movie'}/${poster?.id ?? ''}`;
  if (!poster) return { title: null, path: null };
  const kind = type === 'serie' ? 'سریال' : 'فیلم';
  const story = parseDescription(poster.description).synopsis.replace(/\s+/g, ' ').trim();
  const year = poster.year ? ` ${poster.year}` : '';
  const description = story ? `${kind} ${poster.title}${year}: ${story}`.slice(0, 160) : `تماشای ${kind} ${poster.title}${year} در ${SITE}.`;
  return { title: `${kind} ${poster.title}${year}`, description, path };
}
