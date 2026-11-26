import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Wiring guards for #86. The behaviour itself was checked on the Android TV emulator; these keep the
// fixes from being undone silently.
const player = readFileSync('src/app/player.tsx', 'utf8');
const seekBar = readFileSync('src/player/SeekBar.tsx', 'utf8');

describe('continue watching does not open the end screen (#86)', () => {
  it('ignores the end event of the empty player that opens before the URL is known', () => {
    const handler = player.slice(player.indexOf("useEventListener(player, 'playToEnd'"));
    expect(handler.slice(0, 400)).toMatch(/if \(!loadedUrl\.current \|\| !player\.duration\) return;[\s\S]*setEnded\(true\)/);
  });

  it('clears the end state when a source loads', () => {
    expect(player).toMatch(/\.replaceAsync\([\s\S]{0,200}\.then\(\(\) => \{\s*setEnded\(false\);/);
  });

  it('lets the resume prompt keep the focus and the keys', () => {
    expect(player).toMatch(/hasTVPreferredFocus=\{isTV && entry === 'play' && resumeAt === null\}/);
    expect(player).toMatch(/isTV && !visible && !menu && resumeAt === null \? \(/);
    expect(player).toMatch(/if \(resumeAt !== null\) return;/);
  });
});

describe('a TV mouse can seek and bring the controls back (#86)', () => {
  it('handles press and drag inside the TV seek bar', () => {
    const tv = seekBar.slice(seekBar.indexOf('{tv ? ('), seekBar.indexOf(') : ('));
    expect(tv).toContain('<View {...pointer}');
    expect(seekBar).toMatch(/onResponderRelease:[\s\S]*onSeek\(r \* duration\)/);
  });

  it('does not let the focus holder swallow clicks', () => {
    const holder = player.slice(player.indexOf('isTV && !visible && !menu && resumeAt === null ? ('));
    expect(holder.slice(0, 500)).toContain('pointerEvents="none"');
  });

  it('feeds the subtitle overlay the playing state and rate for its own clock', () => {
    expect(player).toMatch(/<SubtitleOverlay[\s\S]*playing=\{isPlaying\}[\s\S]*rate=\{playbackRate\}/);
  });
});
