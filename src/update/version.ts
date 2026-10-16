import type { GithubRelease } from '@/api/types';

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
