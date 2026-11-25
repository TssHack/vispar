import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Guards the desktop packaging settings that fixed real bugs: missing Linux icons (the hicolor
// theme has no 1024x1024 folder), a window icon that was never packaged, a window not linked to
// its menu entry, and a build that failed when electron-builder could not find the repository.
const DESKTOP = join(__dirname, '..', 'desktop');
const pkg = JSON.parse(readFileSync(join(DESKTOP, 'package.json'), 'utf8'));
const build = pkg.build;

/** Width and height from a PNG's IHDR chunk; throws when the file is not a PNG. */
function pngSize(file: string): [number, number] {
  const b = readFileSync(file);
  if (b.toString('latin1', 1, 4) !== 'PNG') throw new Error(`${file} is not a PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

const SIZES = [16, 24, 32, 48, 64, 128, 256, 512];

describe('desktop packaging config', () => {
  it('builds every Linux format', () => {
    expect(build.linux.target).toEqual(expect.arrayContaining(['AppImage', 'deb', 'rpm', 'pacman']));
  });

  it('installs one icon per hicolor size on Linux', () => {
    expect(build.linux.icon).toBe('build/icons');
    const dir = join(DESKTOP, build.linux.icon);
    expect(readdirSync(dir).sort()).toEqual(SIZES.map((n) => `${n}x${n}.png`).sort());
    for (const n of SIZES) expect(pngSize(join(dir, `${n}x${n}.png`))).toEqual([n, n]);
  });

  it('packages the window icon that main.js loads', () => {
    expect(readFileSync(join(DESKTOP, 'main.js'), 'utf8')).toContain("path.join(__dirname, 'build', 'icon.png')");
    expect(build.files).toContain('build/icon.png');
    expect(pngSize(join(DESKTOP, 'build', 'icon.png'))).toEqual([1024, 1024]);
  });

  it('ties the window to its menu entry', () => {
    // StartupWMClass comes from desktopName, and Electron uses the same name for the window class.
    expect(pkg.desktopName).toBe(`${pkg.name}.desktop`);
    expect(build.linux.syncDesktopName).toBe(true);
  });

  it('names the repository, so the build does not fail at the end', () => {
    expect(pkg.repository?.url).toMatch(/github\.com\/tsshack\/vispar/i);
  });

  it('keeps Windows and macOS on the 1024 px icon', () => {
    expect(build.win.icon).toBe('build/icon.png');
    expect(build.mac.icon).toBe('build/icon.png');
    expect(existsSync(join(DESKTOP, 'build', 'icon.png'))).toBe(true);
  });
});
