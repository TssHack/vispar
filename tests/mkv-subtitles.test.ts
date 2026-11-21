import { describe, expect, it } from 'vitest';

import { blockText, httpRangeFetcher, readMkvIndex, readMkvTrack, readVint } from '@/lib/subtitles/mkv';
import { linesFromText } from '@/lib/subtitles/parse';

// ---- A tiny Matroska writer, enough to build the shapes real files have. ----
const vsize = (n: number): number[] => {
  // 8-byte size, as mkvmerge writes for Segment and Cluster; small elements use 1-4 bytes below.
  if (n < 0x7f) return [0x80 | n];
  if (n < 0x3fff) return [0x40 | (n >> 8), n & 0xff];
  if (n < 0x1fffff) return [0x20 | (n >> 16), (n >> 8) & 0xff, n & 0xff];
  return [0x10 | (n >> 24), (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
};
const idBytes = (id: number): number[] => {
  const out: number[] = [];
  for (let v = id; v > 0; v = Math.floor(v / 256)) out.unshift(v & 0xff);
  return out;
};
const el = (id: number, ...body: (number[] | Uint8Array)[]): number[] => {
  const data = body.flatMap((b) => Array.from(b));
  return [...idBytes(id), ...vsize(data.length), ...data];
};
const u = (id: number, v: number) => {
  const b: number[] = [];
  for (let x = v; x > 0 || b.length === 0; x = Math.floor(x / 256)) b.unshift(x & 0xff);
  return el(id, b);
};
const s = (id: number, v: string) => el(id, Array.from(new TextEncoder().encode(v)));
const fixed8 = (id: number, v: number) => {
  const b = new Array(8).fill(0);
  for (let i = 7, x = v; i >= 0; i--, x = Math.floor(x / 256)) b[i] = x & 0xff;
  return el(id, b);
};

type Line = { time: number; text: string | Uint8Array; duration?: number; group?: boolean };

/**
 * Builds: EBML header, Segment { SeekHead, Info, Tracks, Cluster(s), Cues }. Cluster sizes use 8
 * bytes like mkvmerge. Returns the file and its cue offsets for assertions.
 */
function buildMkv(opts: { lines: Line[]; codec?: string; language?: string; name?: string; cueSubtitles?: boolean; extraTrack?: number[] }) {
  const { lines, codec = 'S_TEXT/UTF8', language = 'per', name, cueSubtitles = true } = opts;
  const header = el(0x1a45dfa3, u(0x4282, 0), s(0x4282, 'matroska'));
  const info = el(0x1549a966, u(0x2ad7b1, 1_000_000));
  const subTrack = el(0xae, u(0xd7, 3), u(0x83, 0x11), s(0x86, codec), s(0x22b59c, language), ...(name ? [s(0x536e, name)] : []), u(0x88, 1));
  const videoTrack = el(0xae, u(0xd7, 1), u(0x83, 1), s(0x86, 'V_MPEG4/ISO/AVC'));
  const tracks = el(0x1654ae6b, videoTrack, subTrack, ...(opts.extraTrack ? [opts.extraTrack] : []));

  // Clusters: one per line, with a video block in front so the relative position is not 0.
  const clusters: number[][] = [];
  const cuePoints: { time: number; cluster: number; relative: number; duration?: number }[] = [];
  const seekHeadSize = 3 * 20; // reserved below with a Void element
  const before = (): number => seekHeadSize + info.length + tracks.length + clusters.reduce((n, c) => n + c.length, 0);
  for (const line of lines) {
    const payload = typeof line.text === 'string' ? Array.from(new TextEncoder().encode(line.text)) : Array.from(line.text);
    const video = el(0xa3, [0x81, 0, 0, 0x80], new Array(300).fill(7));
    const block = [0x83, 0, 0, 0x80, ...payload]; // track 3, timecode 0, keyframe
    const sub = line.group ? el(0xa0, el(0xa1, block), u(0x9b, line.duration ?? 1000)) : el(0xa3, block);
    const data = [...u(0xe7, line.time), ...video, ...sub];
    const relative = u(0xe7, line.time).length + video.length;
    const cluster = [0x1f, 0x43, 0xb6, 0x75, 0x01, 0, 0, 0, 0, 0, (data.length >> 8) & 0xff, data.length & 0xff, ...data];
    cuePoints.push({ time: line.time, cluster: before(), relative, duration: line.group ? undefined : line.duration });
    clusters.push(cluster);
  }
  const cues = el(
    0x1c53bb6b,
    ...cuePoints.map((p) =>
      el(0xbb, u(0xb3, p.time), el(0xb7, u(0xf7, cueSubtitles ? 3 : 1), u(0xf1, p.cluster), u(0xf0, p.relative), ...(p.duration ? [u(0xb2, p.duration)] : []))),
    ),
  );
  const cuesPos = before();
  const seekHead = el(0x114d9b74, el(0x4dbb, el(0x53ab, idBytes(0x1c53bb6b)), fixed8(0x53ac, cuesPos)));
  const pad = el(0xec, new Array(seekHeadSize - seekHead.length - 2).fill(0));
  const body = [...seekHead, ...pad, ...info, ...tracks, ...clusters.flat(), ...cues];
  const segment = [0x18, 0x53, 0x80, 0x67, 0x01, 0, 0, 0, (body.length >> 24) & 0xff, (body.length >> 16) & 0xff, (body.length >> 8) & 0xff, body.length & 0xff, ...body];
  return new Uint8Array([...header, ...segment]);
}

const fetcherOf = (file: Uint8Array) => {
  const calls: [number, number][] = [];
  const f = async (a: number, b: number) => {
    calls.push([a, b]);
    return file.slice(a, Math.min(b + 1, file.length));
  };
  return Object.assign(f, { calls });
};

describe('readVint', () => {
  it('reads sizes above 2^31 (an 860 MB film) without overflowing', () => {
    const v = readVint(new Uint8Array([0x01, 0, 0, 0, 0x33, 0x45, 0x67, 0x89]), 0)!;
    expect(v.value).toBe(0x33456789);
    expect(readVint(new Uint8Array([0x09, 0, 0, 0, 0]), 0)!.value).toBe(2 ** 32);
  });
  it('treats an all-ones size as unknown', () => {
    expect(readVint(new Uint8Array([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]), 0)!.value).toBe(Infinity);
  });
});

describe('reading an embedded subtitle over range requests', () => {
  const lines: Line[] = [
    { time: 57841, text: '‫« خوب زندگی کردن بهترین انتقامه -\n‫یه یارویی »', duration: 5738 },
    { time: 63579, text: '« انتقام بهترین انتقامه »', duration: 1324 },
    { time: 64903, text: '<i>« آلمان - یک سال قبل »</i>', duration: 3153, group: true },
  ];

  it('finds the text track, its language and the index', async () => {
    const file = buildMkv({ lines, name: 'ValaMovie.Com' });
    const index = await readMkvIndex(fetcherOf(file));
    expect(typeof index).toBe('object');
    if (typeof index !== 'object') return;
    expect(index.tracks).toEqual([{ number: 3, format: 'srt', language: 'per', name: 'ValaMovie.Com', isDefault: true, isForced: false }]);
    expect(index.cues[3]).toHaveLength(3);
  });

  it('reads every line with its time, from SimpleBlock and BlockGroup, without the markup and bidi marks', async () => {
    const file = buildMkv({ lines });
    const fetchRange = fetcherOf(file);
    const index = await readMkvIndex(fetchRange);
    if (typeof index !== 'object') throw new Error(index);
    const cues = await readMkvTrack(fetchRange, index, index.tracks[0]!);
    expect(cues.map((c) => [c.start, Math.round(c.end * 1000) / 1000, c.lines])).toEqual([
      [57.841, 63.579, ['« خوب زندگی کردن بهترین انتقامه -', 'یه یارویی »']],
      [63.579, 64.903, ['« انتقام بهترین انتقامه »']],
      [64.903, 68.056, ['« آلمان - یک سال قبل »']],
    ]);
  });

  it('downloads only small ranges, never the whole file', async () => {
    const file = buildMkv({ lines });
    const fetchRange = fetcherOf(file);
    const index = await readMkvIndex(fetchRange);
    if (typeof index !== 'object') throw new Error(index);
    await readMkvTrack(fetchRange, index, index.tracks[0]!);
    for (const [a, b] of fetchRange.calls) expect(b - a).toBeLessThanOrEqual(128 * 1024);
  });

  it('decodes a Windows-1256 track and ASS dialogue', async () => {
    const cp1256 = new Uint8Array([0xd3, 0xe1, 0xc7, 0xe3]); // "سلام"
    const file = buildMkv({ lines: [{ time: 1000, text: cp1256, duration: 900 }] });
    const fr = fetcherOf(file);
    const index = await readMkvIndex(fr);
    if (typeof index !== 'object') throw new Error(index);
    expect((await readMkvTrack(fr, index, index.tracks[0]!))[0]!.lines).toEqual(['سلام']);

    const ass = buildMkv({ codec: 'S_TEXT/ASS', lines: [{ time: 2000, text: '0,0,Default,,0,0,0,,{\\an8}سطر اول\\Nسطر, دوم', duration: 900 }] });
    const fa = fetcherOf(ass);
    const ai = await readMkvIndex(fa);
    if (typeof ai !== 'object') throw new Error(ai);
    expect(ai.tracks[0]!.format).toBe('ass');
    expect((await readMkvTrack(fa, ai, ai.tracks[0]!))[0]!.lines).toEqual(['سطر اول', 'سطر, دوم']);
  });

  it('reports a file whose index has no subtitle entries (ffmpeg-style cues)', async () => {
    expect(await readMkvIndex(fetcherOf(buildMkv({ lines, cueSubtitles: false })))).toBe('no-index');
  });

  it('reports a file without a text track, and a file that is not Matroska', async () => {
    expect(await readMkvIndex(fetcherOf(buildMkv({ lines, codec: 'S_HDMV/PGS' })))).toBe('no-text-track');
    expect(await readMkvIndex(fetcherOf(new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70])))).toBe('not-mkv');
  });

  it('reads the lines around the playback position first', async () => {
    const many: Line[] = Array.from({ length: 30 }, (_, i) => ({ time: (i + 1) * 10_000, text: `خط ${i}`, duration: 1000 }));
    const file = buildMkv({ lines: many });
    const fr = fetcherOf(file);
    const index = await readMkvIndex(fr);
    if (typeof index !== 'object') throw new Error(index);
    const seen: number[] = [];
    await readMkvTrack(fr, index, index.tracks[0]!, { from: 200, concurrency: 1, onProgress: (c) => seen.push(c.length) });
    const firstBlock = fr.calls.findIndex(([a]) => a > 0 && a < file.length - 2000 && a > 200);
    const firstAt = fr.calls[firstBlock + 2]?.[0] ?? 0;
    // The first block fetched after the index belongs to the line at 200 s, not the one at 10 s.
    expect(firstAt).toBeGreaterThan(index.segmentStart + index.cues[3]![15]!.cluster);
    expect(seen.at(-1)).toBe(30);
  });
});

describe('blockText', () => {
  it('ignores a block of another track at the same position', () => {
    const block = new Uint8Array([0xa3, 0x88, 0x81, 0, 0, 0x80, 1, 2, 3, 4]);
    expect(blockText(block, 3)).toBeNull();
  });
});

describe('linesFromText', () => {
  it('keeps only the text of an ASS Dialogue line', () => {
    expect(linesFromText('Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,سلام\\Nدنیا', 'ass')).toEqual(['سلام', 'دنیا']);
  });
});

describe('httpRangeFetcher', () => {
  it('refuses a server that ignores Range instead of downloading the whole film', async () => {
    const realFetch = globalThis.fetch;
    let cancelled = false;
    globalThis.fetch = (async () => ({ status: 200, body: { cancel: async () => void (cancelled = true) } })) as unknown as typeof fetch;
    try {
      await expect(httpRangeFetcher('http://x.test/a.mkv')(0, 10)).rejects.toThrow(/range/);
      expect(cancelled).toBe(true);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
