/**
 * Reading the subtitle out of a Matroska (MKV) file over HTTP range requests (#54).
 *
 * Most of the catalogue is MKV with the subtitle *inside* the file. Android's player can show it, but
 * no browser exposes a Matroska subtitle track, iOS cannot play MKV, and Android draws it tiny and
 * ignores our settings. So we read it ourselves:
 *
 * 1. The first 128 KB hold the SeekHead (where Info, Tracks and Cues are), Info and usually Tracks.
 * 2. Cues (the index, near the end of the file) lists every subtitle block: time, duration and the
 *    position of its cluster. mkvmerge indexes subtitle blocks by default.
 * 3. Each block is a few hundred bytes at `cluster data + relative position`, fetched on its own.
 *
 * A film's subtitle costs one small request per line instead of downloading the whole file. Files
 * without subtitle entries in Cues (ffmpeg writes video cues only) are reported as `no-index`.
 *
 * Pure apart from the injected `fetchRange`, so the parser is tested with Matroska built in memory.
 */

import { decodeSubtitleBytes } from './encoding';
import { linesFromText, type Cue } from './parse';

/** Bytes `start`..`end` inclusive. Must reject (not return the whole file) when the server ignores Range. */
export type RangeFetcher = (start: number, end: number) => Promise<Uint8Array>;

export type MkvTextTrack = {
  number: number;
  format: 'srt' | 'ass';
  /** ISO 639-2 from the file (`per`, `eng`, `und`), or the BCP 47 tag when present. */
  language: string;
  name?: string;
  isDefault: boolean;
  isForced: boolean;
};

export type MkvCuePoint = { time: number; cluster: number; relative: number; duration?: number };

export type MkvIndex = {
  /** Absolute offset of the Segment's data; every position in the file is relative to it. */
  segmentStart: number;
  /** Nanoseconds per timestamp unit (Info/TimestampScale, default 1 ms). */
  timescale: number;
  tracks: MkvTextTrack[];
  /** Cue points per text track number, sorted by time. */
  cues: Record<number, MkvCuePoint[]>;
};

export type MkvReadError = 'not-mkv' | 'no-text-track' | 'no-index' | 'unsupported';

// Element IDs (with their length marker), from the Matroska specification.
const ID = {
  EBML: 0x1a45dfa3,
  Segment: 0x18538067,
  SeekHead: 0x114d9b74,
  Seek: 0x4dbb,
  SeekID: 0x53ab,
  SeekPosition: 0x53ac,
  Info: 0x1549a966,
  TimestampScale: 0x2ad7b1,
  Tracks: 0x1654ae6b,
  TrackEntry: 0xae,
  TrackNumber: 0xd7,
  TrackType: 0x83,
  CodecID: 0x86,
  Language: 0x22b59c,
  LanguageBCP47: 0x22b59d,
  Name: 0x536e,
  FlagDefault: 0x88,
  FlagForced: 0x55aa,
  ContentEncodings: 0x6d80,
  Cues: 0x1c53bb6b,
  CuePoint: 0xbb,
  CueTime: 0xb3,
  CueTrackPositions: 0xb7,
  CueTrack: 0xf7,
  CueClusterPosition: 0xf1,
  CueRelativePosition: 0xf0,
  CueDuration: 0xb2,
  Cluster: 0x1f43b675,
  SimpleBlock: 0xa3,
  BlockGroup: 0xa0,
  Block: 0xa1,
  BlockDuration: 0x9b,
} as const;

const HEAD_BYTES = 128 * 1024;
const BLOCK_BYTES = 4096;
/** A subtitle index larger than this is not a subtitle index we want to download. */
const MAX_CUES_BYTES = 4 * 1024 * 1024;

type Vint = { value: number; length: number };

/** Variable-size integer. `keepMarker` for element IDs. Null when the bytes cannot be one. */
export function readVint(buf: Uint8Array, at: number, keepMarker = false): Vint | null {
  const first = buf[at];
  if (first === undefined || first === 0) return null;
  let length = 1;
  let mask = 0x80;
  while (!(first & mask)) {
    mask >>= 1;
    length++;
  }
  if (at + length > buf.length) return null;
  let value = keepMarker ? first : first & (mask - 1);
  let allOnes = (first & (mask - 1)) === mask - 1;
  for (let k = 1; k < length; k++) {
    const b = buf[at + k]!;
    if (b !== 0xff) allOnes = false;
    value = value * 256 + b; // not << : sizes above 2^31 are normal for an 800 MB file
  }
  // An all-ones size means "unknown" (live-muxed Segment or Cluster).
  if (!keepMarker && allOnes) value = Number.POSITIVE_INFINITY;
  return { value, length };
}

type Element = { id: number; data: number; size: number; end: number };

/** Children of `[start, end)`. Stops at a truncated element instead of throwing. */
function* children(buf: Uint8Array, start: number, end: number): Generator<Element> {
  let at = start;
  const limit = Math.min(end, buf.length);
  while (at < limit) {
    const id = readVint(buf, at, true);
    if (!id) return;
    const size = readVint(buf, at + id.length);
    if (!size) return;
    const data = at + id.length + size.length;
    const elEnd = size.value === Number.POSITIVE_INFINITY ? limit : data + size.value;
    yield { id: id.value, data, size: size.value, end: elEnd };
    if (elEnd <= at) return;
    at = elEnd;
  }
}

const uint = (buf: Uint8Array, el: Element): number => {
  let v = 0;
  for (let i = el.data; i < el.end && i < buf.length; i++) v = v * 256 + buf[i]!;
  return v;
};
const ascii = (buf: Uint8Array, el: Element): string => {
  let s = '';
  for (let i = el.data; i < el.end && i < buf.length; i++) if (buf[i]) s += String.fromCharCode(buf[i]!);
  return s;
};
const utf8 = (buf: Uint8Array, el: Element): string => decodeSubtitleBytes(buf.subarray(el.data, Math.min(el.end, buf.length)));

function formatOf(codec: string): MkvTextTrack['format'] | null {
  if (codec === 'S_TEXT/UTF8' || codec === 'S_TEXT/ASCII' || codec === 'S_TEXT/WEBVTT') return 'srt';
  if (codec === 'S_TEXT/ASS' || codec === 'S_TEXT/SSA' || codec === 'S_ASS' || codec === 'S_SSA') return 'ass';
  return null; // image subtitles (PGS, VobSub) cannot be drawn as text
}

function parseTracks(buf: Uint8Array, tracks: Element): MkvTextTrack[] {
  const out: MkvTextTrack[] = [];
  for (const entry of children(buf, tracks.data, tracks.end)) {
    if (entry.id !== ID.TrackEntry) continue;
    let number = 0;
    let type = 0;
    let codec = '';
    let language = 'eng'; // the specification's default
    let bcp47 = '';
    let name: string | undefined;
    let isDefault = true;
    let isForced = false;
    let encoded = false;
    for (const f of children(buf, entry.data, entry.end)) {
      if (f.id === ID.TrackNumber) number = uint(buf, f);
      else if (f.id === ID.TrackType) type = uint(buf, f);
      else if (f.id === ID.CodecID) codec = ascii(buf, f);
      else if (f.id === ID.Language) language = ascii(buf, f) || language;
      else if (f.id === ID.LanguageBCP47) bcp47 = ascii(buf, f);
      else if (f.id === ID.Name) name = utf8(buf, f).trim() || undefined;
      else if (f.id === ID.FlagDefault) isDefault = uint(buf, f) !== 0;
      else if (f.id === ID.FlagForced) isForced = uint(buf, f) !== 0;
      else if (f.id === ID.ContentEncodings) encoded = true;
    }
    const format = formatOf(codec);
    // Compressed tracks (zlib, header stripping) would need an inflater Hermes does not ship.
    if (type === 0x11 && number && format && !encoded) out.push({ number, format, language: bcp47 || language, name, isDefault, isForced });
  }
  return out;
}

function parseCues(buf: Uint8Array, start: number, end: number, wanted: Set<number>): Record<number, MkvCuePoint[]> {
  const out: Record<number, MkvCuePoint[]> = {};
  for (const point of children(buf, start, end)) {
    if (point.id !== ID.CuePoint) continue;
    let time = -1;
    const positions: Element[] = [];
    for (const f of children(buf, point.data, point.end)) {
      if (f.id === ID.CueTime) time = uint(buf, f);
      else if (f.id === ID.CueTrackPositions) positions.push(f);
    }
    if (time < 0) continue;
    for (const pos of positions) {
      let track = 0;
      let cluster = -1;
      let relative = -1;
      let duration: number | undefined;
      for (const f of children(buf, pos.data, pos.end)) {
        if (f.id === ID.CueTrack) track = uint(buf, f);
        else if (f.id === ID.CueClusterPosition) cluster = uint(buf, f);
        else if (f.id === ID.CueRelativePosition) relative = uint(buf, f);
        else if (f.id === ID.CueDuration) duration = uint(buf, f);
      }
      // Without a relative position the block could be anywhere in a cluster of megabytes.
      if (!wanted.has(track) || cluster < 0 || relative < 0) continue;
      (out[track] ??= []).push({ time, cluster, relative, duration });
    }
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.time - b.time);
  return out;
}

/** Reads the head and the index. Never downloads more than the head, Tracks, Info and Cues. */
export async function readMkvIndex(fetchRange: RangeFetcher): Promise<MkvIndex | MkvReadError> {
  const head = await fetchRange(0, HEAD_BYTES - 1);
  const ebml = readVint(head, 0, true);
  if (!ebml || ebml.value !== ID.EBML) return 'not-mkv';
  const top = [...children(head, 0, head.length)];
  const segment = top.find((e) => e.id === ID.Segment);
  if (!segment) return 'not-mkv';
  const segmentStart = segment.data;

  const seek: Record<number, number> = {};
  let info: Element | undefined;
  let tracksEl: Element | undefined;
  let tracksBuf = head;
  for (const el of children(head, segmentStart, head.length)) {
    if (el.id === ID.SeekHead) {
      for (const s of children(head, el.data, el.end)) {
        if (s.id !== ID.Seek) continue;
        let sid = 0;
        let pos = -1;
        for (const f of children(head, s.data, s.end)) {
          if (f.id === ID.SeekID) sid = uint(head, f);
          else if (f.id === ID.SeekPosition) pos = uint(head, f);
        }
        if (sid && pos >= 0 && seek[sid] === undefined) seek[sid] = pos;
      }
    } else if (el.id === ID.Info && el.end <= head.length) info = el;
    else if (el.id === ID.Tracks && el.end <= head.length) tracksEl = el;
    else if (el.id === ID.Cluster) break;
  }

  let timescale = 1_000_000;
  if (info) for (const f of children(head, info.data, info.end)) if (f.id === ID.TimestampScale) timescale = uint(head, f) || timescale;

  // Tracks past the head (rare): fetch it on its own.
  if (!tracksEl && seek[ID.Tracks] !== undefined) {
    const at = segmentStart + seek[ID.Tracks]!;
    const probe = await fetchRange(at, at + 15);
    const id = readVint(probe, 0, true);
    const size = id && readVint(probe, id.length);
    if (id?.value === ID.Tracks && size && size.value < MAX_CUES_BYTES) {
      tracksBuf = await fetchRange(at, at + id.length + size.length + size.value - 1);
      tracksEl = { id: ID.Tracks, data: id.length + size.length, size: size.value, end: id.length + size.length + size.value };
    }
  }
  if (!tracksEl) return 'not-mkv';
  const tracks = parseTracks(tracksBuf, tracksEl);
  if (!tracks.length) return 'no-text-track';

  const cuesAt = seek[ID.Cues];
  if (cuesAt === undefined) return 'no-index';
  const at = segmentStart + cuesAt;
  const probe = await fetchRange(at, at + 15);
  const id = readVint(probe, 0, true);
  const size = id && readVint(probe, id.length);
  if (!id || id.value !== ID.Cues || !size || size.value > MAX_CUES_BYTES) return 'no-index';
  const cuesBuf = await fetchRange(at, at + id.length + size.length + size.value - 1);
  const cues = parseCues(cuesBuf, id.length + size.length, cuesBuf.length, new Set(tracks.map((t) => t.number)));
  const indexed = tracks.filter((t) => cues[t.number]?.length);
  if (!indexed.length) return 'no-index';
  return { segmentStart, timescale, tracks: indexed, cues };
}

/**
 * Finds the block at the start of `buf` for `track`. `buf` begins at the earliest possible data
 * start of the cluster (cluster position + 4-byte ID + 1-byte size), so the real start is up to 7
 * bytes in, depending on how many bytes the muxer used for the cluster size.
 */
export function blockText(buf: Uint8Array, track: number): { payload: Uint8Array; duration?: number } | null {
  for (let skip = 0; skip <= 7; skip++) {
    const id = readVint(buf, skip, true);
    if (!id || (id.value !== ID.SimpleBlock && id.value !== ID.BlockGroup)) continue;
    const size = readVint(buf, skip + id.length);
    if (!size || !Number.isFinite(size.value) || size.value > BLOCK_BYTES * 4) continue;
    let block: Element = { id: id.value, data: skip + id.length + size.length, size: size.value, end: skip + id.length + size.length + size.value };
    let duration: number | undefined;
    if (id.value === ID.BlockGroup) {
      let inner: Element | undefined;
      for (const f of children(buf, block.data, block.end)) {
        if (f.id === ID.Block) inner = f;
        else if (f.id === ID.BlockDuration) duration = uint(buf, f);
      }
      if (!inner) continue;
      block = inner;
    }
    const tn = readVint(buf, block.data);
    if (!tn || tn.value !== track) continue;
    const flags = buf[block.data + tn.length + 2];
    if (flags === undefined || flags & 0x06) continue; // laced frames: never used for text
    const start = block.data + tn.length + 3;
    if (block.end > buf.length || start > block.end) continue;
    return { payload: buf.subarray(start, block.end), duration };
  }
  return null;
}

export type ReadTrackOptions = {
  /** Playback position in seconds: the nearest lines are fetched first. */
  from?: number;
  /** Parallel requests, 2 by default and never more than 4 (see below). */
  concurrency?: number;
  /** Called with all cues read so far, sorted, as batches arrive. */
  onProgress?: (cues: Cue[]) => void;
  signal?: { aborted: boolean };
};

/** Reads every line of one track. Lines that fail to fetch are skipped, not fatal. */
export async function readMkvTrack(fetchRange: RangeFetcher, index: MkvIndex, track: MkvTextTrack, options: ReadTrackOptions = {}): Promise<Cue[]> {
  const points = index.cues[track.number] ?? [];
  const toSeconds = (t: number) => (t * index.timescale) / 1e9;
  const from = options.from ?? 0;
  // Nearest first: the lines from the playback position on, then the earlier ones.
  const firstAhead = points.findIndex((p) => toSeconds(p.time) >= from - 2);
  const order = firstAhead <= 0 ? points.slice() : [...points.slice(firstAhead), ...points.slice(0, firstAhead).reverse()];

  const cues: Cue[] = [];
  /** Lines whose length was guessed (no CueDuration, no BlockDuration). */
  const guessed = new Set<Cue>();
  let next = 0;
  let lastReport = 0;
  const report = (force = false) => {
    if (!options.onProgress || (!force && cues.length - lastReport < 20)) return;
    lastReport = cues.length;
    options.onProgress([...cues].sort((a, b) => a.start - b.start));
  };

  const worker = async () => {
    while (next < order.length && !options.signal?.aborted) {
      const point = order[next++]!;
      const clusterAt = index.segmentStart + point.cluster;
      const from5 = clusterAt + 5 + point.relative;
      try {
        const buf = await fetchRange(from5, from5 + 7 + BLOCK_BYTES - 1);
        const found = blockText(buf, track.number);
        if (!found) continue;
        const lines = linesFromText(decodeSubtitleBytes(found.payload), track.format);
        if (!lines.length) continue;
        const start = toSeconds(point.time);
        const dur = point.duration ?? found.duration;
        const cue: Cue = { start, end: dur ? start + toSeconds(dur) : start + 4, lines };
        if (!dur) guessed.add(cue);
        cues.push(cue);
        report();
      } catch {
        // one missing line must not cost the rest
      }
    }
  };
  // Two at a time: browsers open at most 6 connections per host over HTTP/1.1, and the video itself
  // streams from the same host. Six subtitle requests starved the video (seen on a real file: playback
  // stalled while the lines loaded), so most connections stay free for it.
  await Promise.all(Array.from({ length: Math.max(1, Math.min(options.concurrency ?? 2, 4)) }, worker));
  cues.sort((a, b) => a.start - b.start);
  // A line without a duration lasts until the next one at most.
  for (let i = 0; i + 1 < cues.length; i++) if (guessed.has(cues[i]!) && cues[i]!.end > cues[i + 1]!.start) cues[i]!.end = cues[i + 1]!.start;
  report(true);
  return cues;
}

/**
 * A `RangeFetcher` over `fetch`. Refuses a `200` (a server that ignores Range would send the whole
 * film) and cancels its body at once. Each request gives up after `timeoutMs`: on a real file the
 * first request once stalled for a minute while the video was filling its buffer.
 */
export function httpRangeFetcher(url: string, signal?: AbortSignal, timeoutMs = 20_000): RangeFetcher {
  return async (start, end) => {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : undefined;
    const stop = () => ctrl?.abort();
    signal?.addEventListener?.('abort', stop);
    const timer = setTimeout(stop, timeoutMs);
    try {
      const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` }, signal: ctrl?.signal ?? signal });
      if (res.status !== 206) {
        try {
          await res.body?.cancel();
        } catch {
          // nothing to cancel
        }
        throw new RangeRefused(res.status);
      }
      return new Uint8Array(await res.arrayBuffer());
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', stop);
    }
  };
}

/** The server answered without honouring Range. Retrying cannot help. */
export class RangeRefused extends Error {
  constructor(status: number) {
    super(`range not supported (${status})`);
  }
}

/**
 * Retries a failed range request (timeout, dropped connection) a few times with a growing pause.
 * One slow answer must not cost the whole subtitle; a server that refuses Range is not retried.
 */
export function retrying(fetchRange: RangeFetcher, attempts = 3, pauseMs = 1500, signal?: { aborted: boolean }): RangeFetcher {
  return async (start, end) => {
    let last: unknown;
    for (let i = 0; i < attempts; i++) {
      if (signal?.aborted) break;
      try {
        return await fetchRange(start, end);
      } catch (err) {
        last = err;
        if (err instanceof RangeRefused) break;
        if (i + 1 < attempts) await new Promise((r) => setTimeout(r, pauseMs * (i + 1)));
      }
    }
    throw last ?? new Error('aborted');
  };
}
