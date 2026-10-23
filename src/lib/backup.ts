import type { ContentType } from '@/api/types';
import type { EpisodeRef, Library, Progress, SavedPoster } from '@/library/store';

export const BACKUP_VERSION = 1;
export const MAX_BACKUP_CHARS = 5_000_000;
export const MAX_PROGRESS_ENTRIES = 300;

export type ParseResult = { ok: true; library: Library } | { ok: false; reason: 'empty' | 'too-large' | 'not-json' | 'not-backup' | 'version' };

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const str = (x: unknown) => (typeof x === 'string' ? x : undefined);
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);

/**
 * Copies only the fields we know, so unknown keys from a pasted file never reach the store.
 * `sources` is dropped on purpose: a backup is untrusted text and those are URLs the player would open.
 */
function cleanPoster(x: unknown): SavedPoster | null {
  if (!isObj(x)) return null;
  const id = num(x.id);
  const type = x.type === 'movie' || x.type === 'serie' ? (x.type as ContentType) : null;
  const title = str(x.title);
  if (id === undefined || !type || !title) return null;
  const genres: SavedPoster['genres'] = [];
  for (const g of Array.isArray(x.genres) ? x.genres.slice(0, 12) : []) {
    if (isObj(g) && num(g.id) !== undefined && str(g.title)) genres.push({ id: num(g.id) as number, title: str(g.title) as string });
  }
  const p: SavedPoster = { id, type, title, image: str(x.image) ?? '', cover: str(x.cover) ?? '', year: num(x.year) ?? 0, imdb: num(x.imdb) ?? 0, genres };
  const description = str(x.description);
  if (description !== undefined) p.description = description;
  const rating = num(x.rating);
  if (rating !== undefined) p.rating = rating;
  return p;
}

function cleanEpisode(x: unknown): EpisodeRef | undefined {
  if (!isObj(x)) return undefined;
  const seasonIndex = num(x.seasonIndex);
  const episodeIndex = num(x.episodeIndex);
  const episodeId = num(x.episodeId);
  if (seasonIndex === undefined || episodeIndex === undefined || episodeId === undefined) return undefined;
  return { seasonIndex, episodeIndex, episodeId, title: str(x.title) ?? '' };
}

export function buildBackup(library: Library, now = Date.now()): string {
  return JSON.stringify({ app: 'vispar', kind: 'library', version: BACKUP_VERSION, exportedAt: now, favorites: library.favorites, progress: library.progress });
}

export function parseBackup(text: string): ParseResult {
  const t = text.trim();
  if (!t) return { ok: false, reason: 'empty' };
  if (t.length > MAX_BACKUP_CHARS) return { ok: false, reason: 'too-large' };
  let raw: unknown;
  try {
    raw = JSON.parse(t);
  } catch {
    return { ok: false, reason: 'not-json' };
  }
  if (!isObj(raw) || raw.app !== 'vispar' || raw.kind !== 'library') return { ok: false, reason: 'not-backup' };
  if (raw.version !== BACKUP_VERSION) return { ok: false, reason: 'version' };

  const favorites: Library['favorites'] = [];
  for (const f of Array.isArray(raw.favorites) ? raw.favorites : []) {
    const poster = isObj(f) ? cleanPoster(f.poster) : null;
    if (poster) favorites.push({ poster, addedAt: (isObj(f) && num(f.addedAt)) || 0 });
  }

  const progress: Library['progress'] = {};
  if (isObj(raw.progress)) {
    for (const [key, v] of Object.entries(raw.progress)) {
      if (!isObj(v)) continue;
      const poster = cleanPoster(v.poster);
      const position = num(v.position);
      const duration = num(v.duration);
      if (!poster || position === undefined || duration === undefined || duration <= 0) continue;
      const entry: Progress = { key, poster, position, duration, updatedAt: num(v.updatedAt) ?? 0 };
      const episode = cleanEpisode(v.episode);
      if (episode) entry.episode = episode;
      progress[key] = entry;
    }
  }
  return { ok: true, library: { favorites, progress } };
}

const favKey = (p: SavedPoster) => `${p.type}:${p.id}`;

/** Union of both libraries. Never lowers what is already here: the newer progress entry wins per key. */
export function mergeLibrary(current: Library, incoming: Library): { library: Library; addedFavorites: number; addedProgress: number } {
  const seen = new Set(current.favorites.map((f) => favKey(f.poster)));
  const extra = incoming.favorites.filter((f) => !seen.has(favKey(f.poster)));
  const favorites = [...current.favorites, ...extra].sort((a, b) => b.addedAt - a.addedAt);

  const progress: Library['progress'] = { ...current.progress };
  let addedProgress = 0;
  for (const [key, p] of Object.entries(incoming.progress)) {
    const mine = progress[key];
    if (!mine) addedProgress++;
    if (!mine || p.updatedAt > mine.updatedAt) progress[key] = p;
  }
  const keys = Object.keys(progress);
  if (keys.length > MAX_PROGRESS_ENTRIES) {
    keys
      .sort((a, b) => progress[a].updatedAt - progress[b].updatedAt)
      .slice(0, keys.length - MAX_PROGRESS_ENTRIES)
      .forEach((k) => delete progress[k]);
  }
  return { library: { favorites, progress }, addedFavorites: extra.length, addedProgress };
}
