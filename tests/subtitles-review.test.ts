import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => {
  const mem = new Map<string, string>();
  return { default: { getItem: async (k: string) => mem.get(k) ?? null, setItem: async (k: string, v: string) => void mem.set(k, v) } };
});

import { decodeCp1256, decodeSubtitleBytes, isValidUtf8, persianise } from '@/lib/subtitles/encoding';
import { loadSubtitle, sidecarCandidates } from '@/lib/subtitles/load';
import { planSidecar } from '@/lib/subtitles/plan';
import { selectChoice, setSubtitleChoice, subtitleStore } from '@/lib/subtitles/store';

const bytes = (...n: number[]) => Uint8Array.from(n);

describe('subtitle encoding', () => {
  it('decodes Windows-1256 Persian text', () => {
    // سلام in cp1256
    expect(decodeCp1256(bytes(0xd3, 0xe1, 0xc7, 0xe3))).toBe('سلام');
  });

  it('keeps ZWNJ and maps Arabic yeh/kaf to the Persian letters after a cp1256 decode', () => {
    expect(decodeCp1256(bytes(0xe5, 0x9d, 0xe5))).toBe('ه‌ه');
    expect(persianise(decodeCp1256(bytes(0xed, 0xdf)))).toBe('یک');
  });

  it('knows cp1256 bytes are not UTF-8, and real UTF-8 is', () => {
    expect(isValidUtf8(bytes(0xd3, 0xe1, 0xc7, 0xe3))).toBe(false);
    expect(isValidUtf8(new TextEncoder().encode('سلام دنیا ✓'))).toBe(true);
    expect(isValidUtf8(bytes(0xe2, 0x82))).toBe(false); // truncated sequence
  });

  it('picks the right decoder by sniffing', () => {
    expect(decodeSubtitleBytes(bytes(0xd3, 0xe1, 0xc7, 0xe3))).toBe('سلام');
    expect(decodeSubtitleBytes(new TextEncoder().encode('سلام'))).toBe('سلام');
    expect(decodeSubtitleBytes(bytes(0xef, 0xbb, 0xbf, ...new TextEncoder().encode('ok')))).toContain('ok');
  });

  it('decodes UTF-16 with a byte order mark', () => {
    expect(decodeSubtitleBytes(bytes(0xff, 0xfe, 0x68, 0x00, 0x69, 0x00))).toBe('hi');
    expect(decodeSubtitleBytes(bytes(0xfe, 0xff, 0x00, 0x68, 0x00, 0x69))).toBe('hi');
  });
});

describe('loading a cp1256 subtitle file', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('turns the bytes into readable Persian cues', async () => {
    // "1\n00:00:01,000 --> 00:00:02,000\nسلام\n" with the text in cp1256
    const head = new TextEncoder().encode('1\n00:00:01,000 --> 00:00:02,000\n');
    const body = bytes(0xd3, 0xe1, 0xc7, 0xe3, 0x0a);
    const file = new Uint8Array([...head, ...body]);
    vi.stubGlobal('fetch', async () => new Response(file, { status: 200 }));
    const result = await loadSubtitle('http://x.test/a.fa.srt');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.cues[0]!.lines).toEqual(['سلام']);
  });
});

describe('sidecar probing order', () => {
  it('puts the bare .srt within the two default attempts', () => {
    const first = sidecarCandidates('http://x.test/a/Movie.2024.mkv').slice(0, 2);
    expect(first).toEqual(['http://x.test/a/Movie.2024.fa.srt', 'http://x.test/a/Movie.2024.srt']);
  });
});

describe('planSidecar', () => {
  const base = { source: { url: 'http://x/a.mkv', quality: '1080' }, enabled: true, autoProbe: true, hasEmbeddedTracks: false, saved: {}, probedFor: null };

  it('probes when nothing else applies', () => {
    expect(planSidecar(base)).toBe('probe');
  });
  it('never probes once the user turned subtitles off for the title', () => {
    expect(planSidecar({ ...base, saved: { off: true } })).toBe('disabled');
    // ... even if a URL had been saved earlier (the bug: off + url removed => probed again)
    expect(planSidecar({ ...base, saved: { off: true, url: 'http://x/a.srt' } })).toBe('disabled');
  });
  it('loads a saved URL before probing', () => {
    expect(planSidecar({ ...base, saved: { url: 'http://x/a.srt' } })).toBe('load-saved');
  });
  it('skips burned-in subtitles, embedded tracks, a repeated probe and disabled settings', () => {
    expect(planSidecar({ ...base, source: { url: 'http://x/a.HardSub.mkv' } })).toBe('disabled');
    expect(planSidecar({ ...base, hasEmbeddedTracks: true })).toBe('none');
    expect(planSidecar({ ...base, probedFor: 'http://x/a.mkv' })).toBe('none');
    expect(planSidecar({ ...base, autoProbe: false })).toBe('none');
    expect(planSidecar({ ...base, enabled: false })).toBe('none');
    expect(planSidecar({ ...base, source: null })).toBe('none');
  });
});

describe('subtitle store', () => {
  beforeEach(() => subtitleStore.set({}));

  it('returns one stable empty value, so useSyncExternalStore does not loop (React error 185)', () => {
    const a = selectChoice({}, 'movie:1');
    expect(selectChoice({}, 'movie:2')).toBe(a);
    expect(selectChoice({ 'movie:3': { off: true } }, null)).toBe(a);
    expect(selectChoice({ 'movie:3': { off: true } }, 'movie:3')).toEqual({ off: true });
  });

  it('moves an updated title to the end so a daily-used title is evicted last', () => {
    setSubtitleChoice('a', { offsetMs: 250 });
    setSubtitleChoice('b', { offsetMs: 250 });
    setSubtitleChoice('a', { offsetMs: 500 });
    expect(Object.keys(subtitleStore.get())).toEqual(['b', 'a']);
    expect(subtitleStore.get().a).toEqual({ offsetMs: 500 });
  });
});
