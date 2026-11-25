/** How the Linux desktop app was installed. Kept free of react-native imports so it is unit-tested. */
export type LinuxPackage = 'appimage' | 'deb' | 'rpm' | 'pacman';

const KINDS: readonly string[] = ['appimage', 'deb', 'rpm', 'pacman'];

/** File extension of each format in a release. */
export const LINUX_EXT: Record<LinuxPackage, string> = { appimage: '.appimage', deb: '.deb', rpm: '.rpm', pacman: '.pacman' };

export function parseLinuxPackage(value: unknown): LinuxPackage | null {
  return typeof value === 'string' && KINDS.includes(value) ? (value as LinuxPackage) : null;
}

let pending: Promise<LinuxPackage | null> | null = null;

/**
 * Asks the desktop shell how it was installed (desktop/main.js answers app://vispar/_install).
 * Resolves to null when it cannot tell: a dev run, another format, or a shell older than this
 * endpoint (that one answers with index.html, which is not JSON). Asked once per launch.
 */
export function readLinuxPackage(fetchImpl: typeof fetch = fetch): Promise<LinuxPackage | null> {
  pending ??= fetchImpl('/_install', { headers: { Accept: 'application/json' } })
    .then((res) => (res.ok ? res.json() : null))
    .then((body) => parseLinuxPackage((body as { kind?: unknown } | null)?.kind))
    .catch(() => null);
  return pending;
}

/** For tests: forget the cached answer. */
export function resetLinuxPackage() {
  pending = null;
}

/** The command that installs a downloaded file, shown under the download button. */
export function installCommand(file: string, kind: LinuxPackage): string {
  switch (kind) {
    case 'deb':
      return `sudo apt install ./${file}`;
    case 'rpm':
      return `sudo dnf install ./${file}`;
    case 'pacman':
      return `sudo pacman -U ${file}`;
    case 'appimage':
      return `chmod +x ${file}`;
  }
}

/** The format a downloaded file is, from its name (null for files that are not a Linux build). */
export function linuxPackageOf(file: string): LinuxPackage | null {
  const name = file.toLowerCase();
  return (Object.keys(LINUX_EXT) as LinuxPackage[]).find((k) => name.endsWith(LINUX_EXT[k])) ?? null;
}
