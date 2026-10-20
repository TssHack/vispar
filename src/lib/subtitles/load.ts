import { decodeSubtitleBytes } from './encoding';
import { MAX_SUBTITLE_BYTES, parseSubtitles, type Cue } from './parse';

/**
 * Fetching subtitle files.
 *
 * Two constraints shape this:
 * - A sidecar `.srt` usually has no CORS headers, so in a browser the fetch fails. That is a normal
 *   outcome here, not an exception to bubble up: the caller gets null and offers manual entry.
 * - Files serve from slow hosts, so the timeout is short and the fallback is silence, never a spinner
 *   on top of the video.
 */

export type LoadResult =
  | { ok: true; cues: Cue[]; url: string }
  | { ok: false; reason: 'empty' | 'too-large' | 'unreachable' | 'unparseable' };

const TIMEOUT_MS = 8000;

/** Reads at most `MAX_SUBTITLE_BYTES` of raw bytes, so a mislabelled video file cannot exhaust memory. */
async function readCapped(res: Response): Promise<Uint8Array | null> {
  if (!res.body) {
    const all = new Uint8Array(await res.arrayBuffer());
    return all.byteLength > MAX_SUBTITLE_BYTES ? null : all;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_SUBTITLE_BYTES) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // already released by cancel()
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** Fetches and parses one subtitle URL. Never throws. */
export async function loadSubtitle(url: string): Promise<LoadResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'force-cache' });
    if (!res.ok) return { ok: false, reason: 'unreachable' };
    const bytes = await readCapped(res);
    if (bytes === null) return { ok: false, reason: 'too-large' };
    // Persian files are often Windows-1256, so decode by sniffing rather than assuming UTF-8.
    const text = decodeSubtitleBytes(bytes);
    if (!text.trim()) return { ok: false, reason: 'empty' };
    const cues = parseSubtitles(text);
    return cues.length ? { ok: true, cues, url } : { ok: false, reason: 'unparseable' };
  } catch {
    // Abort, CORS, offline and DNS failures all land here on purpose: the caller's answer is the
    // same either way, and a failed subtitle must never interrupt playback.
    return { ok: false, reason: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Conventional sidecar names next to a video file.
 *
 * `Movie.2024.1080p.mkv` → `Movie.2024.1080p.fa.srt` and so on. Ordered by likelihood: the Persian
 * suffix first (this app's audience), then the bare name.
 */
export function sidecarCandidates(videoUrl: string): string[] {
  // Drop the query and fragment before editing the extension; they belong to the video, not the
  // subtitle, and stripping them avoids `...mkv.srt?token=...`.
  const withoutQuery = videoUrl.split(/[?#]/)[0] ?? videoUrl;
  const dot = withoutQuery.lastIndexOf('.');
  const slash = withoutQuery.lastIndexOf('/');
  // Only treat a trailing segment as an extension when it looks like one.
  const hasExtension = dot > slash && dot > 0 && /^[a-z0-9]{1,5}$/i.test(withoutQuery.slice(dot + 1));
  const base = hasExtension ? withoutQuery.slice(0, dot) : withoutQuery;

  const names: string[] = [];
  // `.srt` is second on purpose: the default probe only tries the first two names, and the bare
  // `Movie.srt` is the most common sidecar there is.
  for (const suffix of ['.fa.srt', '.srt', '.persian.srt', '.fa.vtt', '.vtt']) names.push(`${base}${suffix}`);
  return names;
}

/**
 * Tries the sidecar names in order and returns the first that parses.
 *
 * Sequential on purpose: firing five requests at a slow CDN to save a few hundred milliseconds is a
 * poor trade, and the first hit wins in the common case anyway.
 */
export async function probeSidecar(videoUrl: string, attempts = 2): Promise<LoadResult> {
  for (const url of sidecarCandidates(videoUrl).slice(0, attempts)) {
    const result = await loadSubtitle(url);
    if (result.ok) return result;
  }
  return { ok: false, reason: 'unreachable' };
}
