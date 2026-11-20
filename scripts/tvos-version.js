#!/usr/bin/env node
/**
 * Prints the react-native-tvos release to build the Android TV APK with: the newest stable fork
 * release of the exact react-native version in package.json (`0.88.1` → `0.88.1-0`, or `-1`, `-2`
 * when the fork publishes fixes). Release candidates are never picked.
 *
 * Used by .github/workflows/android.yml so the TV build cannot drift from the phone build again
 * (it was pinned by hand to 0.88.0-0rc2 while the app was on 0.88.1).
 */
const { execFileSync } = require('node:child_process');
const path = require('node:path');

/** Newest `<rn>-<n>` in `versions`, or null. `rn` must be an exact x.y.z version. */
function pickTvosVersion(rn, versions) {
  if (!/^\d+\.\d+\.\d+$/.test(rn)) throw new Error(`react-native must be pinned to an exact version, got "${rn}"`);
  const re = new RegExp(`^${rn.replace(/\./g, '\\.')}-(\\d+)$`);
  let best = null;
  for (const v of versions) {
    const m = re.exec(v);
    if (m && (best === null || Number(m[1]) > best)) best = Number(m[1]);
  }
  return best === null ? null : `${rn}-${best}`;
}

module.exports = { pickTvosVersion };

if (require.main === module) {
  const pkg = require(path.join(__dirname, '..', 'package.json'));
  const rn = pkg.dependencies['react-native'];
  const versions = JSON.parse(execFileSync('npm', ['view', 'react-native-tvos', 'versions', '--json'], { encoding: 'utf8' }));
  const picked = pickTvosVersion(rn, versions);
  if (!picked) {
    console.error(`No stable react-native-tvos release for react-native ${rn}. Wait for the fork, or pin react-native to a version it has.`);
    process.exit(1);
  }
  process.stdout.write(picked);
}
