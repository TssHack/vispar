/**
 * Subtitle parsing.
 *
 * Everything here is pure and platform-free so it can be unit tested directly, and so the player
 * only has to deal with a flat, sorted cue list.
 *
 * Format support: SubRip (`.srt`) and WebVTT (`.vtt`). Both are plain text with timing lines, so a
 * tolerant parser that reads timing lines and text runs handles real files better than a strict
 * grammar: files in the wild contain BOMs, CRLF, stray index lines, HTML-ish tags and overlapping
 * cues.
 */

export type Cue = {
  /** Inclusive start, in seconds. */
  start: number;
  /** Exclusive end, in seconds. */
  end: number;
  /** Plain text, one entry per rendered line. */
  lines: string[];
};

/** Never accept an absurd file: a feature-length film uses a few thousand cues at most. */
export const MAX_SUBTITLE_BYTES = 2 * 1024 * 1024;

/** `00:01:02,500`, `0:01:02.5`, and `01:02.500` (VTT allows omitting the hour). */
const TIMING =
  /^\s*(?:(\d{1,3}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})\s*-->\s*(?:(\d{1,3}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;

const toSeconds = (h: string | undefined, m: string, s: string, ms: string): number => {
  const hours = h ? Number(h) : 0;
  const minutes = Number(m);
  const seconds = Number(s);
  // ".5" means 500 ms, ".05" means 50 ms: pad rather than parse as a number.
  const millis = Number(ms.padEnd(3, '0').slice(0, 3));
  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
};

/**
 * SubRip and WebVTT both allow inline markup. We render plain text, so tags are stripped rather
 * than rendered: `<i>` is not dangerous, but `{\an8}` and `<font color=...>` are noise.
 */
function cleanLine(raw: string): string {
  return raw
    .replace(/\{\\[^}]*\}/g, '') // ASS/SSA override blocks
    .replace(/<\/?[a-zA-Z][^>]*>/g, '') // <i>, <b>, <font ...>
    .replace(/\u200f|\u200e/g, '') // stray direction marks
    .replace(/\s+$/g, '')
    .trim();
}

/** Normalises a subtitle payload to text: strips a BOM and converts to plain CRLF-free lines. */
export function normaliseText(input: string): string {
  return input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

/** Detects the format, so the caller can label a track without re-reading the payload. */
export function detectFormat(input: string): 'srt' | 'vtt' | 'unknown' {
  const head = normaliseText(input).slice(0, 64).toUpperCase();
  if (head.includes('WEBVTT')) return 'vtt';
  if (TIMING.test(normaliseText(input).split('\n').find((l) => l.includes('-->')) ?? '')) return 'srt';
  return 'unknown';
}

/**
 * Parses a SubRip or WebVTT document into sorted, de-duplicated cues.
 *
 * Malformed blocks are skipped rather than throwing: one bad cue should cost that cue, not the
 * whole file.
 */
export function parseSubtitles(input: string): Cue[] {
  const text = normaliseText(input);
  const lines = text.split('\n');
  const cues: Cue[] = [];

  let i = 0;
  while (i < lines.length) {
    const timing = TIMING.exec(lines[i] ?? '');
    if (!timing) {
      i++;
      continue;
    }

    const start = toSeconds(timing[1], timing[2]!, timing[3]!, timing[4]!);
    const end = toSeconds(timing[5], timing[6]!, timing[7]!, timing[8]!);

    // Text runs until a blank line or the next timing line, whichever comes first.
    const body: string[] = [];
    i++;
    while (i < lines.length) {
      const line = lines[i] ?? '';
      if (line.trim() === '' || TIMING.test(line)) break;
      const cleaned = cleanLine(line);
      if (cleaned) body.push(cleaned);
      i++;
    }

    // Skip empty and inverted cues; they render as flicker or never show.
    if (body.length && end > start) cues.push({ start, end, lines: body });
  }

  // Sort because some files are out of order, and drop exact duplicates that pollute the lookup.
  cues.sort((a, b) => a.start - b.start || a.end - b.end);
  return cues.filter((cue, index) => {
    const previous = cues[index - 1];
    return !previous || previous.start !== cue.start || previous.end !== cue.end || previous.lines.join('\n') !== cue.lines.join('\n');
  });
}

/** Alias kept for call sites that read better as "parse this SRT"; both formats are handled. */
export const parseSrt = parseSubtitles;

/**
 * The cue covering `time`, or null in a gap.
 *
 * Binary search, because this runs on every player tick: a linear scan over a few thousand cues
 * would be the most expensive thing in the render loop.
 */
export function cueAt(cues: Cue[], time: number): Cue | null {
  let low = 0;
  let high = cues.length - 1;
  let found: Cue | null = null;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const cue = cues[mid]!;
    if (time < cue.start) {
      high = mid - 1;
    } else if (time >= cue.end) {
      low = mid + 1;
    } else {
      found = cue;
      // Keep searching left: overlapping cues are common, and the earliest one should win.
      high = mid - 1;
    }
  }
  return found;
}

/** Shifts every cue, for the "subtitles are early" case. Keeps order without re-sorting. */
export function shiftCues(cues: Cue[], offsetSeconds: number): Cue[] {
  if (!offsetSeconds) return cues;
  return cues.map((cue) => ({ ...cue, start: Math.max(0, cue.start + offsetSeconds), end: Math.max(0, cue.end + offsetSeconds) }));
}

/**
 * Whether a source is likely to carry its own visible subtitles.
 *
 * `HardSub` is burned into the picture, so overlaying anything would double it. `SoftSub` and the
 * Persian quality labels mean a track worth offering.
 */
export function subtitleHint(source: { quality?: string; url?: string }): 'hard' | 'soft' | null {
  const haystack = `${source.quality ?? ''} ${source.url ?? ''}`;
  if (/hardsub/i.test(haystack)) return 'hard';
  if (/softsub|زیرنویس/i.test(haystack)) return 'soft';
  return null;
}
