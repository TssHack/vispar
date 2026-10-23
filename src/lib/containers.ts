/**
 * Which file container a source is, and whether the built-in player can decode it on a platform.
 * Pure and platform-free (the platform is an explicit argument), so it can be unit tested and shared
 * by the detail screens, the player and next-episode autoplay.
 */

export type PlayerPlatform = 'ios' | 'android' | 'web' | 'desktop';
export type Container = 'mkv' | 'mp4' | 'webm' | 'm3u8' | 'avi' | 'wmv' | 'flv' | 'mov' | 'other';

type SourceLike = { url: string; type?: string; quality?: string };

const KNOWN: Container[] = ['mkv', 'mp4', 'webm', 'm3u8', 'avi', 'wmv', 'flv', 'mov'];

/** Extension of the URL path (query and fragment dropped, percent-encoding decoded), or ''. */
function extensionOf(url: string): string {
  const withoutQuery = url.split(/[?#]/)[0] ?? url;
  let path = withoutQuery;
  try {
    path = decodeURIComponent(withoutQuery);
  } catch {
    // a malformed escape: use the raw text
  }
  const slash = path.lastIndexOf('/');
  const dot = path.lastIndexOf('.');
  if (dot <= slash) return '';
  return path.slice(dot + 1).toLowerCase();
}

/**
 * The container of a source. The URL's extension is what the file really is, so it wins; the API's
 * `type` field is only a fallback for URLs without an extension (one source in the catalogue says
 * `mkv` for a `.mp4` URL). Returns null when neither says anything usable.
 */
export function containerOf(source: SourceLike): Container | null {
  const ext = extensionOf(source.url);
  if ((KNOWN as string[]).includes(ext)) return ext as Container;
  if (ext && /^[a-z0-9]{1,5}$/.test(ext)) return 'other';
  const type = (source.type ?? '').toLowerCase().trim();
  if ((KNOWN as string[]).includes(type)) return type as Container;
  if (/m3u8/.test(type)) return 'm3u8';
  return null;
}

/** Containers AVPlayer (the only decoder behind `expo-video` on iOS) cannot play. */
const IOS_UNSUPPORTED: Container[] = ['mkv', 'avi', 'wmv', 'flv'];

/**
 * Can the built-in player decode this source on `platform`? Deliberately conservative: only
 * containers known to fail are rejected, so an unknown or odd URL is still attempted and the
 * external-player route stays an extra option, never a replacement. Android, the desktop app and the
 * web are unchanged (the web hands playback to external players anyway).
 */
export function canPlayInApp(source: SourceLike, platform: PlayerPlatform): boolean {
  if (platform !== 'ios') return true;
  const container = containerOf(source);
  return container === null || !IOS_UNSUPPORTED.includes(container);
}

/** Teasers and trailers are short clips, not the film: never a stand-in for it. */
export function isTrailer(source: SourceLike): boolean {
  const quality = source.quality ?? '';
  return /تیزر|trailer|teaser/i.test(quality) || /\/tizer\/|trailer|teaser/i.test(source.url);
}

export const containerLabel = (container: Container | null): string => (container ? container.toUpperCase() : '');
