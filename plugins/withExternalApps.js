/**
 * Declares the external players and download managers Vispar can hand links to.
 * Android 11+ hides other apps unless they are listed in <queries>; without this the app
 * can't tell which ones are installed. Keep the list in sync with src/external/apps.ts.
 */
const { withAndroidManifest } = require('expo/config-plugins');

const PACKAGES = [
  'org.videolan.vlc',
  'com.mxtech.videoplayer.ad',
  'com.mxtech.videoplayer.pro',
  'is.xyz.mpv',
  'com.brouken.player',
  'org.xbmc.kodi',
  'com.kmplayer',
  'video.player.videoplayer',
  'com.newin.nplayer.pro',
  'com.dv.adm',
  'com.dv.adm.pay',
  'idm.internet.download.manager',
  'idm.internet.download.manager.plus',
  'org.freedownloadmanager.fdm',
];

module.exports = function withExternalApps(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries ?? [{}];
    const q = manifest.queries[0];
    q.package = q.package ?? [];
    const existing = new Set(q.package.map((p) => p.$['android:name']));
    for (const name of PACKAGES) if (!existing.has(name)) q.package.push({ $: { 'android:name': name } });
    // Also allow the generic "open video with…" chooser.
    q.intent = q.intent ?? [];
    q.intent.push({ action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }], data: [{ $: { 'android:mimeType': 'video/*' } }] });
    return cfg;
  });
};

module.exports.PACKAGES = PACKAGES;
