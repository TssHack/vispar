export const MAX_RECENT = 8;
export const EMPTY_RECENT: readonly string[] = Object.freeze([]);

/** Trim, collapse spaces and unify Arabic letters so ي/ی and ك/ک are the same search. */
export function normalizeSearch(q: string): string {
  return q
    .replace(/[‌‏‎]/g, ' ')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim();
}

const key = (q: string) => normalizeSearch(q).toLowerCase();

export function addRecent(list: readonly string[], q: string): readonly string[] {
  const clean = normalizeSearch(q);
  if (clean.length < 2) return list;
  const rest = list.filter((x) => key(x) !== key(clean));
  return [clean, ...rest].slice(0, MAX_RECENT);
}

export function removeRecent(list: readonly string[], q: string): readonly string[] {
  const next = list.filter((x) => key(x) !== key(q));
  return next.length === list.length ? list : next;
}

export function migrateRecent(saved: unknown): readonly string[] {
  const raw = Array.isArray(saved) ? saved : (saved as { list?: unknown } | null)?.list;
  if (!Array.isArray(raw)) return EMPTY_RECENT;
  let out: readonly string[] = EMPTY_RECENT;
  for (const x of [...raw].reverse()) if (typeof x === 'string') out = addRecent(out, x);
  return out;
}
