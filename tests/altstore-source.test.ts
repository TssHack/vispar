import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// The SideStore / AltStore source (#95).
const { buildSource, changelogNotes, SOURCE_URL } = createRequire(import.meta.url)('../scripts/altstore-source.js') as {
  buildSource: (o: { version: string; date: string; size: number; notes: string }) => any;
  changelogNotes: (changelog: string, version: string) => string;
  SOURCE_URL: string;
};

describe('SideStore / AltStore source', () => {
  const src = buildSource({ version: '2.5.1', date: '2026-11-26', size: 30_000_000, notes: 'Fixed things.' });
  const app = src.apps[0];

  it('points at the .ipa of that release, under the bundle id the app is built with', () => {
    expect(app.bundleIdentifier).toBe(JSON.parse(readFileSync('app.json', 'utf8')).expo.ios.bundleIdentifier);
    expect(app.versions[0].downloadURL).toBe('https://github.com/TssHack/vispar/releases/download/v2.5.1/Vispar-2.5.1-ios-unsigned.ipa');
    expect(app.versions[0]).toMatchObject({ version: '2.5.1', date: '2026-11-26', size: 30_000_000, minOSVersion: '15.1' });
  });

  it('keeps the old top-level fields for older SideStore/AltStore versions', () => {
    expect(app).toMatchObject({ version: '2.5.1', downloadURL: app.versions[0].downloadURL, size: 30_000_000, versionDescription: 'Fixed things.' });
  });

  it('lives at an address that never changes: the latest release', () => {
    expect(src.sourceURL).toBe(SOURCE_URL);
    expect(SOURCE_URL).toBe('https://github.com/TssHack/vispar/releases/latest/download/altstore-source.json');
  });

  it('refuses a missing size or a non-release version', () => {
    expect(() => buildSource({ version: '2.5.1', date: 'x', size: 0, notes: '' })).toThrow();
    expect(() => buildSource({ version: 'main', date: 'x', size: 1, notes: '' })).toThrow();
  });

  it('takes the notes of that version from CHANGELOG.md, as plain text', () => {
    const notes = changelogNotes(readFileSync('CHANGELOG.md', 'utf8'), '2.5.1');
    expect(notes).toContain('iPhone and iPad: "play with another player" works inside the player');
    expect(notes).not.toContain('**');
    expect(notes).not.toContain('###');
    expect(notes.startsWith('Fixed:')).toBe(true);
    expect(notes).not.toContain('## [2.5.0]');
    expect(changelogNotes('## [1.0.0]\n- a', '9.9.9')).toBe('');
  });

  it('is written and attached to every release by the iOS workflow', () => {
    const wf = readFileSync('.github/workflows/ios.yml', 'utf8');
    expect(wf).toMatch(/node scripts\/altstore-source\.js "out\/Vispar-\$\{VERSION\}-ios-unsigned\.ipa" > out\/altstore-source\.json/);
  });
});
