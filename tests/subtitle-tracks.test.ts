import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { isPersianTrack, pickTrack, subtitleLinkFrom, trackLabel, type TrackInfo } from '@/lib/subtitles/tracks';

const t = (o: Partial<TrackInfo> & { id: string }): TrackInfo => ({ language: 'und', label: '', ...o });

describe('pickTrack', () => {
  const english = t({ id: '1', language: 'en', label: 'English' });
  const persian = t({ id: '2', language: 'fa', label: 'Persian' });

  it('picks Persian for a Persian preference, wherever it is in the list', () => {
    expect(pickTrack([english, persian], 'fa')?.id).toBe('2');
  });

  it('recognises Persian by the container name when the language tag is wrong or vague', () => {
    const mislabelled = t({ id: '3', language: 'en', label: 'English', name: 'Farsi' });
    const named = t({ id: '4', language: 'und', label: '', name: 'زیرنویس فارسی' });
    expect(pickTrack([english, mislabelled], 'fa')?.id).toBe('3');
    expect(pickTrack([english, named], 'fa')?.id).toBe('4');
  });

  it('accepts the ISO 639-2 codes some players leave unnormalised', () => {
    expect(isPersianTrack(t({ id: 'a', language: 'per' }))).toBe(true);
    expect(isPersianTrack(t({ id: 'b', language: 'fas' }))).toBe(true);
    expect(isPersianTrack(t({ id: 'c', language: 'fa-IR' }))).toBe(true);
    expect(isPersianTrack(t({ id: 'd', language: 'fo', label: 'Faroese' }))).toBe(false);
  });

  it('prefers the default-flagged one among several Persian tracks (SDH vs. normal)', () => {
    const sdh = t({ id: '5', language: 'fa', name: 'Farsi SDH' });
    const main = t({ id: '6', language: 'fa', name: 'Farsi', isDefault: true });
    expect(pickTrack([sdh, main], 'fa')?.id).toBe('6');
  });

  it('honours the language the user picked for this title before', () => {
    expect(pickTrack([english, persian], 'fa', 'en')?.id).toBe('1');
  });

  it('falls back to the default track, then the first, when nothing matches', () => {
    const def = t({ id: '7', language: 'de', isDefault: true });
    expect(pickTrack([english, def], 'fa')?.id).toBe('7');
    expect(pickTrack([english], 'fa')?.id).toBe('1');
    expect(pickTrack([], 'fa')).toBeNull();
  });
});

describe('trackLabel', () => {
  it('shows the container name when there is one, else the platform label', () => {
    expect(trackLabel(t({ id: '1', language: 'fa', label: 'Persian', name: 'Farsi SDH' }))).toBe('Farsi SDH');
    expect(trackLabel(t({ id: '2', language: 'fa', label: 'Persian' }))).toBe('Persian');
    expect(trackLabel(t({ id: '3', language: 'fa', label: '' }))).toBe('fa');
  });
});

describe('useSubtitles wiring (the bugs lived here, not in the units)', () => {
  const src = readFileSync('src/hooks/useSubtitles.ts', 'utf8');

  it('listens for the tracks the player reports after the file loads', () => {
    // Without these the list was read once, before loading, and stayed empty for good.
    expect(src).toMatch(/useEventListener\(player, 'availableSubtitleTracksChange'/);
    expect(src).toMatch(/useEventListener\(player, 'sourceLoad'/);
  });

  it('mirrors the track the player picks on its own', () => {
    expect(src).toMatch(/useEventListener\(player, 'subtitleTrackChange'/);
  });

  it('assigns only tracks looked up in the live array (a foreign object crashes natively)', () => {
    expect(src).toMatch(/player\.availableSubtitleTracks/);
    expect(src).not.toMatch(/player\.subtitleTrack = (track|pick|best)/);
  });
});

describe('subtitleLinkFrom (pasted from the clipboard)', () => {
  it('takes the first http(s) link and ignores trailing text', () => {
    expect(subtitleLinkFrom('  https://subs.test/a/Movie.fa.srt  \n')).toBe('https://subs.test/a/Movie.fa.srt');
    expect(subtitleLinkFrom('http://x.test/get.php?id=4 thanks')).toBe('http://x.test/get.php?id=4');
  });
  it('rejects anything that is not a web link', () => {
    expect(subtitleLinkFrom('')).toBeNull();
    expect(subtitleLinkFrom('just some text')).toBeNull();
    expect(subtitleLinkFrom('file:///sdcard/a.srt')).toBeNull();
    expect(subtitleLinkFrom('javascript:alert(1)')).toBeNull();
  });
});

describe('the player menu keeps its promise', () => {
  it('offers the paste action that the "not found" row points to', () => {
    const player = readFileSync('src/app/player.tsx', 'utf8');
    expect(player).toContain('چسباندن لینک زیرنویس');
    expect(player).toMatch(/subs\.loadFromUrl\(/);
  });
});
