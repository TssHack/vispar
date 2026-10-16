import type { ContentType, Country, Episode, Genre, GithubRelease, Poster, Season, Source } from './types';

/**
 * Parsers mirror the Android app's behaviour: missing strings become '', missing numbers 0,
 * duration "null"/"N/A" is treated as absent, and list items that fail to parse are skipped
 * rather than failing the whole page.
 */
type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

export const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

export const num = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

export const duration = (v: unknown): string | null => {
  const s = str(v).trim();
  if (!s || s.toLowerCase() === 'null' || s.toUpperCase() === 'N/A') return null;
  return s;
};

const list = <T>(v: unknown, parse: (o: Obj) => T | null): T[] => {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const item of v) {
    if (!isObj(item)) continue;
    try {
      const parsed = parse(item);
      if (parsed) out.push(parsed);
    } catch {
      // skip malformed item
    }
  }
  return out;
};

export const parseGenre = (o: Obj): Genre => ({ id: num(o.id), title: str(o.title) });
export const parseCountry = (o: Obj): Country => ({ id: num(o.id), title: str(o.title), image: str(o.image) });
export const parseSource = (o: Obj): Source | null => {
  const url = str(o.url);
  if (!url) return null;
  return { id: num(o.id), quality: str(o.quality), type: str(o.type), url };
};

export const parsePoster =
  (fallbackType: ContentType) =>
  (o: Obj): Poster | null => {
    const id = num(o.id);
    if (!id) return null;
    const t = str(o.type);
    return {
      id,
      type: t === 'movie' || t === 'serie' ? t : fallbackType,
      title: str(o.title),
      description: str(o.description),
      year: num(o.year),
      imdb: num(o.imdb),
      rating: num(o.rating),
      duration: duration(o.duration),
      image: str(o.image),
      cover: str(o.cover),
      genres: list(o.genres, parseGenre),
      country: list(o.country, parseCountry),
      sources: list(o.sources, parseSource),
    };
  };

export const parseEpisode = (o: Obj): Episode => ({
  id: num(o.id),
  title: str(o.title),
  description: str(o.description),
  duration: duration(o.duration),
  image: str(o.image),
  sources: list(o.sources, parseSource),
});

export const parseSeason = (o: Obj): Season => ({
  id: num(o.id),
  title: str(o.title),
  episodes: list(o.episodes, parseEpisode),
});

export const parsePosterList = (json: unknown, type: ContentType): Poster[] => list(json, parsePoster(type));
export const parseSeasons = (json: unknown): Season[] => list(json, parseSeason);

/** Search results arrive wrapped as { posters: [...] }; tolerate a bare array too. */
export const parseSearch = (json: unknown): Poster[] => {
  const raw = isObj(json) ? json.posters : json;
  return list(raw, parsePoster('movie'));
};

export const parseRelease = (o: Obj): GithubRelease | null => {
  const tagName = str(o.tag_name);
  if (!tagName) return null;
  const assets = Array.isArray(o.assets) ? o.assets.filter(isObj) : [];
  const apk = assets.find((a) => str(a.name).toLowerCase().endsWith('.apk'));
  return {
    tagName,
    name: str(o.name) || tagName,
    body: str(o.body),
    htmlUrl: str(o.html_url),
    publishedAt: str(o.published_at),
    prerelease: o.prerelease === true,
    draft: o.draft === true,
    assets: assets
      .map((a) => ({ name: str(a.name), url: str(a.browser_download_url), size: num(a.size) }))
      .filter((a) => a.name && a.url),
    apkUrl: apk ? str(apk.browser_download_url) || null : null,
    apkSize: apk ? num(apk.size) || null : null,
  };
};

export const parseReleases = (json: unknown): GithubRelease[] => list(json, parseRelease);
