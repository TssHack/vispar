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
  // Unknown or missing extension (`download.php?file=a`, `/stream/123`): the API's type is all we have.
  const type = (source.type ?? '').toLowerCase().trim();
  if ((KNOWN as string[]).includes(type)) return type as Container;
  if (/m3u8/.test(type)) return 'm3u8';
  if (ext && /^[a-z0-9]{1,5}$/.test(ext)) return 'other';
  return null;
}

/** Containers older iOS players are known to reject. Used only to explain a failure, never to refuse. */
const IOS_RISKY: Container[] = ['mkv', 'avi', 'wmv', 'flv'];

/**
 * Should the built-in player be given this source on `platform`? Always yes (#58).
 *
 * 2.4.0 refused MKV on iOS before trying, on the assumption that AVPlayer cannot decode it. That was
 * never checked on a device, and on the owner's iPhone those files had been playing in the app. A
 * guess must not turn a working path into a guaranteed refusal: the file is always tried, and a real
 * failure is explained by the player's error screen (`likelyUnsupportedOn`), with the external
 * players one tap away.
 */
export function canPlayInApp(_source: SourceLike, _platform: PlayerPlatform): boolean {
  return true;
}

/** When playback has failed: is the container the likely reason on this platform? */
export function likelyUnsupportedOn(source: SourceLike, platform: PlayerPlatform): boolean {
  if (platform !== 'ios') return false;
  const container = containerOf(source);
  return container !== null && IOS_RISKY.includes(container);
}

/** Teasers and trailers are short clips, not the film: never a stand-in for it. */
export function isTrailer(source: SourceLike): boolean {
  const quality = source.quality ?? '';
  return /تیزر|trailer|teaser/i.test(quality) || /\/tizer\/|trailer|teaser/i.test(source.url);
}

export const containerLabel = (container: Container | null): string => (container ? container.toUpperCase() : '');
