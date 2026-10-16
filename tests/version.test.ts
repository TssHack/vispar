import { describe, expect, it } from 'vitest';

import type { GithubRelease } from '@/api/types';
import { compareVersions, findUpdate, parseVersion } from '@/update/version';

const rel = (tagName: string, extra: Partial<GithubRelease> = {}): GithubRelease => ({
  tagName,
  name: tagName,
  body: '',
  htmlUrl: '',
  publishedAt: '',
  prerelease: false,
  draft: false,
  assets: [],
  apkUrl: null,
  apkSize: null,
  ...extra,
});

describe('versions', () => {
  it('parses tags with prefixes and missing parts', () => {
    expect(parseVersion('v2.1.0')).toEqual([2, 1, 0]);
    expect(parseVersion('2.1')).toEqual([2, 1, 0]);
    expect(parseVersion('release-3')).toEqual([3, 0, 0]);
    expect(parseVersion('latest')).toBeNull();
  });

  it('compares numerically, not as strings', () => {
    expect(compareVersions('v2.10.0', 'v2.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.2.3', '1.3')).toBeLessThan(0);
  });

  it('offers only a newer, stable, published release', () => {
    const list = [rel('v1.9.0'), rel('v2.2.0', { prerelease: true }), rel('v2.1.0'), rel('v3.0.0', { draft: true })];
    expect(findUpdate(list, '2.0.0')?.tagName).toBe('v2.1.0');
    expect(findUpdate(list, '2.1.0')).toBeNull();
    expect(findUpdate(list, '2.1.0', { includePrerelease: true })?.tagName).toBe('v2.2.0');
  });
});

import { pickAsset } from '@/update/version';

describe('pickAsset', () => {
  const a = (name: string) => ({ name, url: `https://dl/${name}`, size: 1 });
  const release = { assets: [a('Vispar-2.1.0-win-x64.exe'), a('Vispar-2.1.0-portable.exe'), a('Vispar-2.1.0-mac-arm64.dmg'), a('Vispar-2.1.0-linux-x86_64.AppImage'), a('vispar.apk')] };
  it('picks the right installer per platform', () => {
    expect(pickAsset(release, 'android')?.name).toBe('vispar.apk');
    expect(pickAsset(release, 'windows')?.name).toBe('Vispar-2.1.0-win-x64.exe');
    expect(pickAsset(release, 'mac')?.name).toMatch(/\.dmg$/);
    expect(pickAsset(release, 'linux')?.name).toMatch(/AppImage$/);
  });
  it('keeps phone and TV APKs apart', () => {
    const r = { assets: [a('Vispar-2.1.1-android-tv.apk'), a('Vispar-2.1.1-android.apk')] };
    expect(pickAsset(r, 'android')?.name).toBe('Vispar-2.1.1-android.apk');
    expect(pickAsset(r, 'android', { tv: true })?.name).toBe('Vispar-2.1.1-android-tv.apk');
  });
  it('never updates a phone to the x86_64-only APK', () => {
    const r = { assets: [a('Vispar-2.1.2-android-tv-x86_64.apk'), a('Vispar-2.1.2-android-tv.apk'), a('Vispar-2.1.2-android-x86_64.apk'), a('Vispar-2.1.2-android.apk')] };
    expect(pickAsset(r, 'android')?.name).toBe('Vispar-2.1.2-android.apk');
    expect(pickAsset(r, 'android', { tv: true })?.name).toBe('Vispar-2.1.2-android-tv.apk');
  });
  it('returns null when nothing matches', () => {
    expect(pickAsset({ assets: [] }, 'windows')).toBeNull();
  });
});
