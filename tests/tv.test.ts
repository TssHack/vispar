import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

import { createFocusClaim } from '@/lib/focusClaim';
import { railHeight, railMetrics, SIDE_RAIL_WIDTH, tvHeroHeight, tvHeroTitleSize } from '@/lib/tvLayout';

describe('focus claim (one-shot initial focus on TV)', () => {
  it('prefers only the first item', () => {
    const c = createFocusClaim(true);
    expect(c.prefer(0)).toBe(true);
    expect(c.prefer(1)).toBe(false);
  });

  it('stops preferring once anything in the group was focused, so a remounted first item does not steal focus', () => {
    const c = createFocusClaim(true);
    c.claim();
    expect(c.prefer(0)).toBe(false);
  });

  it('never prefers when disabled (phones, web without ?tv=1)', () => {
    expect(createFocusClaim(false).prefer(0)).toBe(false);
  });
});

describe('TV layout', () => {
  const ITEMS = 6; // home, movies, series, search, library, settings

  it.each([540, 600, 720, 1080])('fits the whole side rail, settings included, on a %i dp tall screen', (h) => {
    const m = railMetrics(h, ITEMS);
    expect(railHeight(m, ITEMS)).toBeLessThanOrEqual(h);
    expect(m.item).toBeGreaterThanOrEqual(40); // still a comfortable D-pad target
  });

  it('keeps the original roomy rail when the screen is tall enough', () => {
    expect(railMetrics(1080, ITEMS).item).toBe(68);
  });

  it('shares one rail width with the grids (they used to subtract 96 from a 112 dp rail)', () => {
    expect(SIDE_RAIL_WIDTH).toBeGreaterThan(0);
    for (const file of ['src/components/AppNav.tsx', 'src/components/CatalogGrid.tsx', 'src/app/(tabs)/library.tsx']) {
      const src = readFileSync(file, 'utf8');
      expect(src, file).toContain('SIDE_RAIL_WIDTH');
      expect(src, file).not.toMatch(/isTV \? (96|112)\b/);
    }
  });

  it('leaves room below the hero on a 540 dp screen', () => {
    expect(tvHeroHeight(540)).toBeLessThanOrEqual(540 * 0.7);
    expect(tvHeroHeight(1080)).toBe(470);
    expect(tvHeroTitleSize(540)).toBeLessThan(tvHeroTitleSize(720));
  });
});

describe('Android TV build uses the matching stable TV fork', () => {
  const { pickTvosVersion } = createRequire(import.meta.url)('../scripts/tvos-version.js') as { pickTvosVersion: (rn: string, v: string[]) => string | null };
  const published = ['0.87.1-1', '0.88.0-0rc2', '0.88.0-0', '0.88.1-0', '0.88.1-2', '0.88.1-10', '0.88.101-tv.0'];

  it('picks the newest stable fork release of the exact react-native version', () => {
    expect(pickTvosVersion('0.88.1', published)).toBe('0.88.1-10');
    expect(pickTvosVersion('0.88.0', published)).toBe('0.88.0-0');
  });

  it('never picks a release candidate or another version', () => {
    expect(pickTvosVersion('0.88.2', published)).toBeNull();
    expect(pickTvosVersion('0.88.0', ['0.88.0-0rc2'])).toBeNull();
  });

  it('refuses a react-native range, so the TV build cannot guess', () => {
    expect(() => pickTvosVersion('^0.88.1', published)).toThrow();
  });

  it('the workflow reads the version from package.json instead of a hand-written pin', () => {
    const wf = readFileSync('.github/workflows/android.yml', 'utf8');
    expect(wf).toContain('node scripts/tvos-version.js');
    expect(wf).not.toMatch(/react-native-tvos@\d/);
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['react-native']).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('TV tabs stay visible after switching (#52)', () => {
  it('does not detach inactive tab screens on TV', () => {
    const src = readFileSync('src/app/(tabs)/_layout.tsx', 'utf8');
    expect(src).toMatch(/detachInactiveScreens=\{!isTV\}/);
  });
});
