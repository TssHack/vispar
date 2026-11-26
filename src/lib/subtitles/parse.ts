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
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '') // stray direction marks and embeddings (RLE/PDF)
    .replace(/\s+$/g, '')
    .trim();
}

/**
 * Lines of one subtitle event, cleaned the same way as file cues. `ass` takes a Matroska ASS/SSA
 * block (`ReadOrder,Layer,Style,Name,MarginL,MarginR,MarginV,Effect,Text`) or a Dialogue line, and
 * keeps only the text, where `\N` and `\n` are line breaks.
 */
export function linesFromText(text: string, format: 'srt' | 'ass' = 'srt'): string[] {
  let body = normaliseText(text);
  if (format === 'ass') {
    const fields = body.replace(/^Dialogue:\s*/i, '').split(',');
    // Matroska blocks have 9 fields (ReadOrder first); Dialogue lines have 10 (Layer first, then Start, End).
    const skip = /^Dialogue:/i.test(body) ? 9 : 8;
    body = fields.length > skip ? fields.slice(skip).join(',') : body;
    body = body.replace(/\\[Nn]/g, '\n');
  }
  return body
    .split('\n')
    .map(cleanLine)
    .filter(Boolean);
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

/** Longest cue of a list, cached per array: bounds how far back an active cue can start. */
const longestCue = new WeakMap<Cue[], number>();
function longest(cues: Cue[]): number {
  let max = longestCue.get(cues);
  if (max === undefined) {
    max = 0;
    for (const c of cues) if (c.end - c.start > max) max = c.end - c.start;
    longestCue.set(cues, max);
  }
  return max;
}

/** Index of the last cue that starts at or before `time` (-1 when none does). */
function lastStartingBy(cues: Cue[], time: number): number {
  let low = 0;
  let high = cues.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cues[mid]!.start <= time) {
      found = mid;
      low = mid + 1;
    } else high = mid - 1;
  }
  return found;
}

/**
 * Every cue covering `time`, earliest first; empty in a gap.
 *
 * Fast dialogue overlaps: the next line often starts before the previous one ends. Returning only
 * one cue hid the later line until the earlier one ended, and a later line that ended first was
 * never shown at all (#86). Cues are sorted by start, but their ends are not, so the search finds
 * the last cue that has started and walks back only as far as the longest cue could reach.
 */
export function cuesAt(cues: Cue[], time: number): Cue[] {
  const last = lastStartingBy(cues, time);
  if (last < 0) return [];
  const reach = time - longest(cues);
  const out: Cue[] = [];
  for (let i = last; i >= 0 && cues[i]!.start >= reach; i--) if (time < cues[i]!.end) out.push(cues[i]!);
  return out.reverse();
}

/** The earliest cue covering `time`, or null in a gap. */
export function cueAt(cues: Cue[], time: number): Cue | null {
  return cuesAt(cues, time)[0] ?? null;
}

/**
 * The first moment after `time` at which the set of visible cues changes (a cue starts or ends), or
 * null when nothing changes any more. The overlay schedules itself on it instead of waiting for the
 * player's next 0.5 s tick, so lines appear and disappear on time.
 */
export function nextCueChange(cues: Cue[], time: number): number | null {
  const last = lastStartingBy(cues, time);
  let next = last + 1 < cues.length ? cues[last + 1]!.start : Infinity;
  const reach = time - longest(cues);
  for (let i = last; i >= 0 && cues[i]!.start >= reach; i--) if (cues[i]!.end > time && cues[i]!.end < next) next = cues[i]!.end;
  return Number.isFinite(next) ? next : null;
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
