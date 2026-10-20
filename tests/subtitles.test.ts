import { describe, expect, it } from 'vitest';

import { cueAt, detectFormat, parseSubtitles, shiftCues, subtitleHint, parseSrt } from '@/lib/subtitles/parse';
import { sidecarCandidates } from '@/lib/subtitles/load';
import { migrateSettings } from '@/settings/store';

describe('subtitle parsing', () => {
  it('parses a minimal SubRip cue', () => {
    const cues = parseSubtitles('1\n00:00:01,000 --> 00:00:03,500\nسلام دنیا\n');
    expect(cues).toHaveLength(1);
    expect(cues[0]!.start).toBe(1);
    expect(cues[0]!.end).toBe(3.5);
    expect(cues[0]!.lines).toEqual(['سلام دنیا']);
  });

  it('handles multi-line text, blank separators and index numbers', () => {
    const srt = ['1', '00:00:01,000 --> 00:00:02,000', 'خط اول', 'خط دوم', '', '2', '00:00:03,000 --> 00:00:04,000', 'بعدی'].join('\n');
    const cues = parseSubtitles(srt);
    expect(cues).toHaveLength(2);
    expect(cues[0]!.lines).toEqual(['خط اول', 'خط دوم']);
  });

  it('parses VTT with a dot separator and a header', () => {
    const vtt = 'WEBVTT\n\n00:00:01.250 --> 00:00:02.750\nHello\n';
    const cues = parseSubtitles(vtt);
    expect(cues[0]!.start).toBeCloseTo(1.25);
    expect(cues[0]!.end).toBeCloseTo(2.75);
  });

  it('accepts VTT without the hour component', () => {
    const cues = parseSubtitles('WEBVTT\n\n01:02.500 --> 01:04.000\nText\n');
    expect(cues[0]!.start).toBeCloseTo(62.5);
  });

  it('reads 1- and 2-digit milliseconds correctly', () => {
    // ".5" is 500 ms, ".05" is 50 ms — not 5 ms.
    expect(parseSubtitles('00:00:00,5 --> 00:00:01,0\na')[0]!.start).toBeCloseTo(0.5);
    expect(parseSubtitles('00:00:00,05 --> 00:00:01,00\na')[0]!.start).toBeCloseTo(0.05);
  });

  it('strips BOM, CRLF and inline markup', () => {
    const raw = '\uFEFF1\r\n00:00:01,000 --> 00:00:02,000\r\n<i>italic</i> and <font color="#fff">colour</font>\r\n';
    const cues = parseSubtitles(raw);
    expect(cues[0]!.lines[0]).toBe('italic and colour');
  });

  it('drops ASS override blocks that would render as noise', () => {
    expect(parseSubtitles('00:00:01,000 --> 00:00:02,000\n{\\an8}بالا\n')[0]!.lines).toEqual(['بالا']);
  });

  it('skips malformed cues without losing the whole file', () => {
    const mixed = ['00:00:01,000 --> 00:00:02,000', 'خوب', '', 'not a timing line', '00:00:05,000 --> 00:00:06,000', 'همچنین خوب'].join('\n');
    const cues = parseSubtitles(mixed);
    expect(cues.map((c) => c.lines[0])).toEqual(['خوب', 'همچنین خوب']);
  });

  it('drops inverted and empty cues', () => {
    expect(parseSubtitles('00:00:05,000 --> 00:00:04,000\nbackwards\n')).toEqual([]);
    expect(parseSubtitles('00:00:01,000 --> 00:00:02,000\n\n')).toEqual([]);
  });

  it('sorts out-of-order cues', () => {
    const out = ['00:00:05,000 --> 00:00:06,000', 'second', '', '00:00:01,000 --> 00:00:02,000', 'first'].join('\n');
    expect(parseSubtitles(out).map((c) => c.lines[0])).toEqual(['first', 'second']);
  });

  it('detects the format', () => {
    expect(detectFormat('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nx')).toBe('vtt');
    expect(detectFormat('1\n00:00:01,000 --> 00:00:02,000\nx')).toBe('srt');
    expect(detectFormat('just some text')).toBe('unknown');
  });

  it('handles an empty payload', () => {
    expect(parseSubtitles('')).toEqual([]);
    expect(parseSubtitles('WEBVTT')).toEqual([]);
  });

  it('exports parseSrt as an alias', () => {
    expect(parseSrt).toBe(parseSubtitles);
  });
});

describe('cue lookup', () => {
  const cues = parseSubtitles(
    ['00:00:01,000 --> 00:00:02,000', 'a', '', '00:00:03,000 --> 00:00:04,000', 'b', '', '00:00:05,000 --> 00:00:06,000', 'c'].join('\n'),
  );

  it('finds the cue covering a time', () => {
    expect(cueAt(cues, 1.5)?.lines[0]).toBe('a');
    expect(cueAt(cues, 3.2)?.lines[0]).toBe('b');
    expect(cueAt(cues, 5.9)?.lines[0]).toBe('c');
  });

  it('returns null in gaps and outside the file', () => {
    expect(cueAt(cues, 0)).toBeNull();
    expect(cueAt(cues, 2.5)).toBeNull();
    expect(cueAt(cues, 99)).toBeNull();
  });

  it('treats the start as inclusive and the end as exclusive', () => {
    expect(cueAt(cues, 1)?.lines[0]).toBe('a');
    expect(cueAt(cues, 2)).toBeNull();
  });

  it('stays correct on a large file', () => {
    // 2000 cues, one every 2 seconds: the lookup must not degrade into a scan.
    const big = Array.from({ length: 2000 }, (_, i) => {
      const start = i * 2;
      const stamp = (s: number) => `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')},000`;
      return `${stamp(start)} --> ${stamp(start + 1)}\nline ${i}`;
    }).join('\n\n');
    const parsed = parseSubtitles(big);
    expect(parsed).toHaveLength(2000);
    const started = performance.now();
    for (let i = 0; i < 5000; i++) cueAt(parsed, (i * 7) % 4000);
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe('cue shifting', () => {
  it('moves cues by the offset', () => {
    const cues = parseSubtitles('00:00:02,000 --> 00:00:03,000\nx');
    expect(shiftCues(cues, 1)[0]!.start).toBeCloseTo(3);
    expect(shiftCues(cues, -1)[0]!.start).toBeCloseTo(1);
  });

  it('clamps at zero rather than producing negative times', () => {
    const cues = parseSubtitles('00:00:00,500 --> 00:00:01,500\nx');
    expect(shiftCues(cues, -5)[0]!.start).toBe(0);
  });

  it('returns the same array for a zero offset', () => {
    const cues = parseSubtitles('00:00:02,000 --> 00:00:03,000\nx');
    expect(shiftCues(cues, 0)).toBe(cues);
  });
});

describe('subtitle hints', () => {
  it('recognises burned-in and muxed subtitles', () => {
    expect(subtitleHint({ url: 'Movie.2024.HardSub.mkv' })).toBe('hard');
    expect(subtitleHint({ quality: '720 زیرنویس', url: 'a.mkv' })).toBe('soft');
    expect(subtitleHint({ url: 'Movie.SoftSub.mkv' })).toBe('soft');
    expect(subtitleHint({ quality: '1080', url: 'a.mkv' })).toBeNull();
  });
});

describe('sidecar candidates', () => {
  it('replaces the extension and prefers Persian names', () => {
    expect(sidecarCandidates('http://x.test/a/Movie.2024.1080p.mkv')).toEqual([
      'http://x.test/a/Movie.2024.1080p.fa.srt',
      'http://x.test/a/Movie.2024.1080p.persian.srt',
      'http://x.test/a/Movie.2024.1080p.fa.vtt',
      'http://x.test/a/Movie.2024.1080p.srt',
      'http://x.test/a/Movie.2024.1080p.vtt',
    ]);
  });

  it('drops query strings so the subtitle URL is clean', () => {
    expect(sidecarCandidates('http://x.test/a/m.mkv?token=1')[0]).toBe('http://x.test/a/m.fa.srt');
  });

  it('handles a URL with no extension', () => {
    expect(sidecarCandidates('http://x.test/stream')[0]).toBe('http://x.test/stream.fa.srt');
  });

  it('does not mistake a dotted directory for an extension', () => {
    expect(sidecarCandidates('http://x.test/a.b/file')[0]).toBe('http://x.test/a.b/file.fa.srt');
  });
});

describe('subtitle settings migration', () => {
  it('fills in the subtitle defaults for an older settings blob', () => {
    const s = migrateSettings({ accent: 'teal' });
    expect(s.subtitleSize).toBe('md');
    expect(s.subtitlesEnabled).toBe(true);
    expect(s.subtitleLanguage).toBe('fa');
    expect(s.subtitleAutoProbe).toBe(true);
  });

  it('keeps valid values and repairs invalid ones', () => {
    expect(migrateSettings({ subtitleSize: 'lg' }).subtitleSize).toBe('lg');
    expect(migrateSettings({ subtitleSize: 'huge' }).subtitleSize).toBe('md');
    expect(migrateSettings({ subtitleLanguage: 'klingon' }).subtitleLanguage).toBe('fa');
    expect(migrateSettings({ subtitlesEnabled: 'yes' }).subtitlesEnabled).toBe(true);
  });
});
