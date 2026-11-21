import { describe, expect, it } from 'vitest';

import type { Source } from '@/api/types';
import { canPlayInApp, likelyUnsupportedOn, containerOf, isTrailer } from '@/lib/containers';
import { pickSource } from '@/lib/sources';

const src = (quality: string, url: string, type = ''): Source => ({ id: 1, quality, type, url });

// Names taken from the live catalogue.
const MKV_1080 = src('1080 زیرنویس', 'http://h.test/film1/Dementium.2026.1080p.WEB-DL.Farsi.Sub.mkv', 'mkv');
const MKV_720 = src('720 زیرنویس', 'http://h.test/film1/Dementium.2026.720p.WEB-DL.Farsi.Sub.mkv', 'mkv');
const MKV_480 = src('480 زیرنویس', 'http://h.test/film1/Dementium.2026.480p.WEB-DL.Farsi.Sub.mkv', 'mkv');
const TRAILER = src('تیزر', 'http://h.test/tizer/Dementium.2026.Trailer.mp4', 'mp4');
const MP4_480 = src('480 دوبله پارس', 'http://h.test/film2/Other.2026.480p.mp4', 'mp4');

describe('containerOf', () => {
  it('reads the extension, ignoring query strings, fragments and case', () => {
    expect(containerOf(src('', 'http://h/a.mkv'))).toBe('mkv');
    expect(containerOf(src('', 'http://h/a.MKV?token=1&x=a.mp4'))).toBe('mkv');
    expect(containerOf(src('', 'http://h/a.mp4#t=10'))).toBe('mp4');
    expect(containerOf(src('', 'http://h/a/b.m3u8'))).toBe('m3u8');
  });

  it('decodes percent-encoded file names', () => {
    expect(containerOf(src('', 'http://h/%D9%81%DB%8C%D9%84%D9%85.mkv'))).toBe('mkv');
    expect(containerOf(src('', 'http://h/a%2Emkv'))).toBe('mkv');
    expect(containerOf(src('', 'http://h/bad%E0%A4%A.mkv'))).toBe('mkv'); // malformed escape still works
  });

  it('trusts the URL over the API type when they disagree (one real source says mkv for a .mp4 URL)', () => {
    expect(containerOf(src('', 'http://h/a.mp4', 'mkv'))).toBe('mp4');
  });

  it('falls back to the API type when the URL has no extension', () => {
    expect(containerOf(src('', 'http://h/stream/123', 'mkv'))).toBe('mkv');
    expect(containerOf(src('', 'http://h/stream/123', 'application/x-mpegURL'))).toBeNull();
    expect(containerOf(src('', 'http://h/stream/123', ''))).toBeNull();
  });

  it('uses the API type for a script-style URL whose extension says nothing (download.php?file=a)', () => {
    expect(containerOf(src('', 'http://h/get/download.php?file=a', 'mkv'))).toBe('mkv');
    expect(containerOf(src('', 'http://h/get/download.php?file=a', ''))).toBe('other');
    expect(likelyUnsupportedOn(src('', 'http://h/get/download.php?file=a', 'mkv'), 'ios')).toBe(true);
  });

  it('does not mistake a dotted directory for an extension', () => {
    expect(containerOf(src('', 'http://h/a.mkv/file'))).toBeNull();
  });
});

describe('canPlayInApp (#58: always try, never refuse on a guess)', () => {
  it('gives every container to the built-in player on every platform, MKV on iOS included', () => {
    for (const u of ['a.mkv', 'a.avi', 'a.wmv', 'a.flv', 'a.mp4', 'a.m3u8', 'stream/123']) {
      for (const platform of ['ios', 'android', 'desktop', 'web'] as const) expect(canPlayInApp(src('', `http://h/${u}`), platform)).toBe(true);
    }
  });
});

describe('likelyUnsupportedOn (explains a real failure)', () => {
  it('blames the container for MKV, AVI, WMV and FLV on iOS only', () => {
    for (const u of ['a.mkv', 'a.avi', 'a.wmv', 'a.flv']) {
      expect(likelyUnsupportedOn(src('', `http://h/${u}`), 'ios')).toBe(true);
      expect(likelyUnsupportedOn(src('', `http://h/${u}`), 'android')).toBe(false);
    }
    expect(likelyUnsupportedOn(src('', 'http://h/a.mp4'), 'ios')).toBe(false);
    expect(likelyUnsupportedOn(src('', 'http://h/stream/123'), 'ios')).toBe(false);
  });
});

describe('isTrailer', () => {
  it('recognises the catalogue trailers', () => {
    expect(isTrailer(TRAILER)).toBe(true);
    expect(isTrailer(src('', 'http://h/x/Film.Trailer.mp4'))).toBe(true);
    expect(isTrailer(MKV_1080)).toBe(false);
    expect(isTrailer(MP4_480)).toBe(false);
  });
});

describe('pickSource with a platform', () => {
  it('never plays the trailer instead of the film (the common catalogue shape)', () => {
    const list = [MKV_1080, MKV_720, TRAILER];
    const pick = pickSource(list, 'best', { platform: 'ios' });
    expect(pick).toBe(MKV_1080);
    expect(pickSource(list, '480', { platform: 'ios' })).not.toBe(TRAILER);
  });

  it('follows the quality preference on iOS too: MKV is no longer demoted (#58)', () => {
    const list = [MKV_1080, MKV_720, MP4_480, TRAILER];
    expect(pickSource(list, 'best', { platform: 'ios' })).toBe(MKV_1080);
    expect(pickSource(list, '720', { platform: 'ios' })).toBe(MKV_720);
  });

  it('picks MKV by quality on every platform', () => {
    const list = [MKV_1080, MP4_480, TRAILER];
    for (const platform of ['ios', 'android', 'desktop', 'web'] as const) {
      expect(pickSource(list, 'best', { platform })).toBe(MKV_1080);
    }
  });

  it('is unchanged without a platform', () => {
    expect(pickSource([MKV_480, MKV_1080], 'best')).toBe(MKV_1080);
    expect(pickSource([TRAILER, MP4_480], 'best')).toBe(MP4_480);
  });

  it('never returns null for a non-empty list on iOS: MKV-only and trailer-only still resolve', () => {
    expect(pickSource([MKV_720, MKV_480], 'best', { platform: 'ios' })).toBe(MKV_720);
    expect(pickSource([TRAILER], 'best', { platform: 'ios' })).toBe(TRAILER);
    expect(pickSource([], 'best', { platform: 'ios' })).toBeNull();
  });
});
