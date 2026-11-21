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

describe('remote keys on Android TV (#53)', () => {
  const load = async () => (await import('@/lib/remoteKeys')).remoteKeyFrom;

  it('counts a key-up when the device sends no key-downs (the default on Android TV)', async () => {
    const remoteKeyFrom = await load();
    const state = { sawKeyDown: false };
    // This was the bug: every press arrived as a key-up and every key-up was dropped.
    expect(remoteKeyFrom({ eventType: 'right', eventKeyAction: 1 }, state)).toBe('right');
    expect(remoteKeyFrom({ eventType: 'up', eventKeyAction: 1 }, state)).toBe('up');
  });

  it('counts each press once when key-downs are sent too', async () => {
    const remoteKeyFrom = await load();
    const state = { sawKeyDown: false };
    expect(remoteKeyFrom({ eventType: 'left', eventKeyAction: 0 }, state)).toBe('left');
    expect(remoteKeyFrom({ eventType: 'left', eventKeyAction: 1 }, state)).toBeNull();
  });

  it('repeats while a key is held, and ignores the final long key-up', async () => {
    const remoteKeyFrom = await load();
    const state = { sawKeyDown: false };
    expect(remoteKeyFrom({ eventType: 'longRight', eventKeyAction: 0 }, state)).toBe('right');
    expect(remoteKeyFrom({ eventType: 'longRight', eventKeyAction: 0 }, state)).toBe('right');
    expect(remoteKeyFrom({ eventType: 'longRight', eventKeyAction: 1 }, state)).toBeNull();
    expect(remoteKeyFrom({ eventType: 'longSelect', eventKeyAction: 0 }, state)).toBe('select');
  });

  it('ignores focus/blur notifications and unknown events', async () => {
    const remoteKeyFrom = await load();
    const state = { sawKeyDown: false };
    expect(remoteKeyFrom({ eventType: 'focus', eventKeyAction: -1 }, state)).toBeNull();
    expect(remoteKeyFrom({ eventType: 'blur', eventKeyAction: -1 }, state)).toBeNull();
    expect(remoteKeyFrom({ eventType: 'channelUp', eventKeyAction: 1 }, state)).toBeNull();
    expect(remoteKeyFrom(null, state)).toBeNull();
  });

  it('leaves play/pause to the media session, so a press is not applied twice', () => {
    const src = readFileSync('src/app/player.tsx', 'utf8');
    expect(src).toMatch(/if \(k === 'playPause' \|\| k === 'play' \|\| k === 'pause'\) return;/);
  });
});

describe('FlatList screens are not blank on TV (#52)', () => {
  const { patchSource, MARKER } = createRequire(import.meta.url)('../scripts/patch-tvos-lists.js') as { patchSource: (s: string) => string; MARKER: string };
  // The exact block from @react-native-tvos/virtualized-lists@0.88.1-0, Lists/VirtualizedList.js.
  const fork = `import {\n  StyleSheet,\n  TVFocusGuideView,\n} from 'react-native';\nclass VirtualizedList {\n  render() {\n    return (\n        {Platform.isTV ? (\n          <TVFocusGuideView\n            {...trapFocusHorizontal}\n            trapFocusUp={false}>\n          </TVFocusGuideView>\n        ) : null}\n    );\n  }\n}\n`;

  it('gives the focus guide the list size, so a flex: 1 list fills its screen', () => {
    const out = patchSource(fork);
    expect(out).toContain('style={__visparGuideStyle(this.props.style)}');
    expect(out).toContain('function __visparGuideStyle(style)');
  });

  it('is idempotent, and refuses a fork whose code changed', () => {
    const once = patchSource(fork);
    expect(patchSource(once)).toBe(once);
    expect(once.split(MARKER).length).toBe(3);
    expect(() => patchSource('export default 1;')).toThrow(/#52/);
  });

  it('runs in the TV build right after the fork is installed', () => {
    const wf = readFileSync('.github/workflows/android.yml', 'utf8');
    const install = wf.indexOf('npm install "react-native@npm:react-native-tvos');
    const patch = wf.indexOf('node scripts/patch-tvos-lists.js');
    const prebuild = wf.indexOf('expo prebuild');
    expect(install).toBeGreaterThan(-1);
    expect(patch).toBeGreaterThan(install);
    expect(prebuild).toBeGreaterThan(patch);
  });
});

describe('the remote reaches the player while the controls are hidden (#53)', () => {
  it('keeps a focusable view focused, because Android sends keys only down the focused path', () => {
    const src = readFileSync('src/app/player.tsx', 'utf8');
    expect(src).toMatch(/isTV && !visible && !menu \? \(\s*<View\s+focusable/);
  });
});
