import { beforeEach, describe, expect, it } from 'vitest';

import { installCommand, linuxPackageOf, parseLinuxPackage, readLinuxPackage, resetLinuxPackage } from '@/update/linuxPackage';
import { pickAsset } from '@/update/version';

const a = (name: string) => ({ name, url: `https://dl/${name}`, size: 1 });
const full = {
  assets: [
    a('Vispar-2.5.0-linux-x86_64.AppImage'),
    a('Vispar-2.5.0-linux-amd64.deb'),
    a('Vispar-2.5.0-linux-x86_64.rpm'),
    a('Vispar-2.5.0-linux-x64.pacman'),
    a('Vispar-2.5.0-win-x64.exe'),
  ],
};
// A release from before .rpm and .pacman were built.
const old = { assets: [a('Vispar-2.4.2-linux-x86_64.AppImage'), a('Vispar-2.4.2-linux-amd64.deb')] };

describe('pickAsset on Linux follows how the app was installed', () => {
  it('offers the same format as the install', () => {
    expect(pickAsset(full, 'linux', { linuxPackage: 'deb' })?.name).toMatch(/\.deb$/);
    expect(pickAsset(full, 'linux', { linuxPackage: 'rpm' })?.name).toMatch(/\.rpm$/);
    expect(pickAsset(full, 'linux', { linuxPackage: 'pacman' })?.name).toMatch(/\.pacman$/);
    expect(pickAsset(full, 'linux', { linuxPackage: 'appimage' })?.name).toMatch(/\.AppImage$/);
  });
  it('falls back to the AppImage when the install is unknown', () => {
    expect(pickAsset(full, 'linux')?.name).toMatch(/\.AppImage$/);
    expect(pickAsset(full, 'linux', { linuxPackage: null })?.name).toMatch(/\.AppImage$/);
  });
  it('falls back to the AppImage when the release has no file of that format', () => {
    expect(pickAsset(old, 'linux', { linuxPackage: 'pacman' })?.name).toMatch(/\.AppImage$/);
    expect(pickAsset(old, 'linux', { linuxPackage: 'rpm' })?.name).toMatch(/\.AppImage$/);
    expect(pickAsset({ assets: [a('Vispar-2.4.2-linux-amd64.deb')] }, 'linux', { linuxPackage: 'rpm' })?.name).toMatch(/\.deb$/);
  });
  it('does not change other platforms', () => {
    expect(pickAsset(full, 'windows', { linuxPackage: 'pacman' })?.name).toMatch(/\.exe$/);
  });
});

describe('parseLinuxPackage', () => {
  it('accepts only the known formats', () => {
    expect(parseLinuxPackage('pacman')).toBe('pacman');
    expect(parseLinuxPackage('appimage')).toBe('appimage');
    for (const v of ['snap', 'PACMAN', '', null, undefined, 3, {}]) expect(parseLinuxPackage(v)).toBeNull();
  });
});

describe('readLinuxPackage', () => {
  beforeEach(() => resetLinuxPackage());
  const json = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

  it('reads the shell answer', async () => {
    expect(await readLinuxPackage(json({ kind: 'rpm' }))).toBe('rpm');
  });
  it('is null when the shell does not know', async () => {
    expect(await readLinuxPackage(json({ kind: null }))).toBeNull();
  });
  it('is null for an older shell, which answers with index.html', async () => {
    const html = (async () => ({ ok: true, json: async () => JSON.parse('<!DOCTYPE html>') })) as unknown as typeof fetch;
    expect(await readLinuxPackage(html)).toBeNull();
  });
  it('is null when the request fails', async () => {
    const fail = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await readLinuxPackage(fail)).toBeNull();
    resetLinuxPackage();
    expect(await readLinuxPackage(json({}, false))).toBeNull();
  });
  it('asks only once per launch', async () => {
    let calls = 0;
    const counting = (async () => {
      calls++;
      return { ok: true, json: async () => ({ kind: 'deb' }) };
    }) as unknown as typeof fetch;
    await Promise.all([readLinuxPackage(counting), readLinuxPackage(counting)]);
    await readLinuxPackage(counting);
    expect(calls).toBe(1);
  });
});

describe('install hints', () => {
  it('match each format', () => {
    expect(installCommand('V.deb', 'deb')).toBe('sudo apt install ./V.deb');
    expect(installCommand('V.rpm', 'rpm')).toBe('sudo dnf install ./V.rpm');
    expect(installCommand('V.pacman', 'pacman')).toBe('sudo pacman -U V.pacman');
    expect(installCommand('V.AppImage', 'appimage')).toBe('chmod +x V.AppImage');
  });
  it('know a file format from its name', () => {
    expect(linuxPackageOf('Vispar-2.5.0-linux-x86_64.AppImage')).toBe('appimage');
    expect(linuxPackageOf('Vispar-2.5.0-linux-x64.pacman')).toBe('pacman');
    expect(linuxPackageOf('Vispar-2.5.0-win-x64.exe')).toBeNull();
  });
});
