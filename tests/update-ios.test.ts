import { afterEach, describe, expect, it, vi } from 'vitest';

import { pickAsset } from '@/update/version';

// The real file names of the 2.5.0 release.
const a = (name: string) => ({ name, url: `https://dl/${name}`, size: 1 });
const release = {
  assets: [
    a('Vispar-2.5.0-android-tv.apk'),
    a('Vispar-2.5.0-android.apk'),
    a('Vispar-2.5.0-ios-simulator.zip'),
    a('Vispar-2.5.0-ios-unsigned.ipa'),
    a('Vispar-2.5.0-mac-arm64.dmg'),
    a('Vispar-2.5.0-mac-arm64.zip'),
  ],
};

describe('iOS updates (#89)', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('react-native');
  });

  const targetOn = async (os: string, ua = '') => {
    vi.resetModules();
    vi.doMock('react-native', () => ({ Platform: { OS: os } }));
    vi.stubGlobal('navigator', { userAgent: ua });
    const { releaseTarget } = await import('@/update/target');
    vi.unstubAllGlobals();
    return releaseTarget();
  };

  it('the iOS app checks the releases, like Android', async () => {
    expect(await targetOn('ios')).toBe('ios');
    expect(await targetOn('android')).toBe('android');
  });

  it('Safari and the home-screen app do not: the web is always the latest deploy', async () => {
    expect(await targetOn('web', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1')).toBeNull();
  });

  it('offers the device .ipa, never the Simulator zip', () => {
    expect(pickAsset(release, 'ios')?.name).toBe('Vispar-2.5.0-ios-unsigned.ipa');
    expect(pickAsset({ assets: [a('Vispar-2.5.0-ios-simulator.zip')] }, 'ios')).toBeNull();
  });

  it('leaves the Mac on the .dmg', () => {
    expect(pickAsset(release, 'mac')?.name).toBe('Vispar-2.5.0-mac-arm64.dmg');
  });
});
