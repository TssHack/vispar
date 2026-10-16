import type { GithubRelease, ReleaseAsset } from '@/api/types';

export type ReleaseTarget = 'android' | 'windows' | 'mac' | 'linux';

/** "v2.1.0", "2.1", "release-2.1.0-beta" → [2, 1, 0]. Returns null when no number is found. */
export function parseVersion(input: string | null | undefined): number[] | null {
  if (!input) return null;
  const m = String(input).match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

/** Negative if a < b, 0 if equal, positive if a > b. Unparseable versions sort lowest. */
export function compareVersions(a: string | null | undefined, b: string | null | undefined): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/** Newest published, non-draft, non-prerelease release that is newer than `current`. */
export function findUpdate(releases: GithubRelease[], current: string, opts: { includePrerelease?: boolean } = {}) {
  const eligible = releases
    .filter((r) => !r.draft && (opts.includePrerelease || !r.prerelease) && parseVersion(r.tagName))
    .sort((x, y) => compareVersions(y.tagName, x.tagName));
  const latest = eligible[0];
  if (!latest) return null;
  return compareVersions(latest.tagName, current) > 0 ? latest : null;
}

/** Picks the installer for a platform out of a release's files (Windows prefers the setup over the portable build). */
export function pickAsset(release: Pick<GithubRelease, 'assets'>, target: ReleaseTarget): ReleaseAsset | null {
  const has = (a: ReleaseAsset, ...ext: string[]) => ext.some((e) => a.name.toLowerCase().endsWith(e));
  const list = release.assets;
  switch (target) {
    case 'android':
      return list.find((a) => has(a, '.apk')) ?? null;
    case 'windows':
      return list.find((a) => has(a, '.exe') && !/portable/i.test(a.name)) ?? list.find((a) => has(a, '.exe')) ?? null;
    case 'mac':
      return list.find((a) => has(a, '.dmg')) ?? list.find((a) => has(a, '.zip') && /mac|darwin/i.test(a.name)) ?? null;
    case 'linux':
      return list.find((a) => has(a, '.appimage')) ?? list.find((a) => has(a, '.deb')) ?? null;
  }
}
