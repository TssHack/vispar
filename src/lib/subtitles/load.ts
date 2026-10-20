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

/** Reads at most `MAX_SUBTITLE_BYTES`, so a mislabelled video file cannot exhaust memory. */
async function readCapped(res: Response): Promise<string | null> {
  if (!res.body) {
    const text = await res.text();
    return text.length > MAX_SUBTITLE_BYTES ? null : text;
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
  const decoder = new TextDecoder('utf-8');
  return chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('') + decoder.decode();
}

/** Fetches and parses one subtitle URL. Never throws. */
export async function loadSubtitle(url: string): Promise<LoadResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'force-cache' });
    if (!res.ok) return { ok: false, reason: 'unreachable' };
    const text = await readCapped(res);
    if (text === null) return { ok: false, reason: 'too-large' };
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
 * `Movie.2024.1080p.mkv` → `Movie.2024.1080p.fa.srt` and so on. Ordered best-first: the Persian
 * suffix before the bare name, because that is the audience this app is built for.
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
  for (const suffix of ['.fa.srt', '.persian.srt', '.fa.vtt', '.srt', '.vtt']) names.push(`${base}${suffix}`);
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
