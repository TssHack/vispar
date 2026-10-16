/**
 * Well-known external players and download managers.
 * Android apps are launched with an explicit VIEW intent for their package; iOS apps through
 * their documented URL schemes. Package names here are also declared in the Android manifest
 * (<queries>, see plugins/withExternalApps.js) so the app can tell which ones are installed.
 */
export type ExternalKind = 'player' | 'downloader';

export type ExternalApp = {
  id: string;
  name: string;
  kind: ExternalKind;
  android?: {
    package: string;
    /** Extra intent fields the app understands. */
    extras?: (title: string) => Record<string, string>;
    /** Some downloaders want a SEND intent with the URL as text. */
    action?: 'view' | 'send';
  };
  ios?: { url: (mediaUrl: string, title: string) => string; appStoreId?: string };
  /** Shown on Android TV too. */
  tv?: boolean;
};

const enc = encodeURIComponent;

export const PLAYERS: ExternalApp[] = [
  {
    id: 'vlc',
    name: 'VLC',
    kind: 'player',
    tv: true,
    android: { package: 'org.videolan.vlc', extras: (title) => ({ title }) },
    ios: { url: (u) => `vlc-x-callback://x-callback-url/stream?url=${enc(u)}`, appStoreId: '650377962' },
  },
  {
    id: 'mx',
    name: 'MX Player',
    kind: 'player',
    tv: true,
    android: { package: 'com.mxtech.videoplayer.ad', extras: (title) => ({ title }) },
  },
  {
    id: 'mxpro',
    name: 'MX Player Pro',
    kind: 'player',
    tv: true,
    android: { package: 'com.mxtech.videoplayer.pro', extras: (title) => ({ title }) },
  },
  { id: 'mpv', name: 'mpv', kind: 'player', tv: true, android: { package: 'is.xyz.mpv' } },
  { id: 'just', name: 'Just Player', kind: 'player', tv: true, android: { package: 'com.brouken.player', extras: (title) => ({ title }) } },
  { id: 'kodi', name: 'Kodi', kind: 'player', tv: true, android: { package: 'org.xbmc.kodi' } },
  { id: 'kmplayer', name: 'KMPlayer', kind: 'player', android: { package: 'com.kmplayer' } },
  { id: 'xplayer', name: 'XPlayer', kind: 'player', android: { package: 'video.player.videoplayer' } },
  {
    id: 'nplayer',
    name: 'nPlayer',
    kind: 'player',
    android: { package: 'com.newin.nplayer.pro' },
    ios: { url: (u) => `nplayer-${u}` },
  },
  { id: 'infuse', name: 'Infuse', kind: 'player', ios: { url: (u) => `infuse://x-callback-url/play?url=${enc(u)}`, appStoreId: '1136220934' } },
  { id: 'outplayer', name: 'Outplayer', kind: 'player', ios: { url: (u) => `outplayer://${u}` } },
];

export const DOWNLOADERS: ExternalApp[] = [
  { id: 'adm', name: 'ADM', kind: 'downloader', android: { package: 'com.dv.adm' } },
  { id: 'admpro', name: 'ADM Pro', kind: 'downloader', android: { package: 'com.dv.adm.pay' } },
  { id: '1dm', name: '1DM', kind: 'downloader', android: { package: 'idm.internet.download.manager' } },
  { id: '1dmplus', name: '1DM+', kind: 'downloader', android: { package: 'idm.internet.download.manager.plus' } },
  { id: 'fdm', name: 'FDM', kind: 'downloader', android: { package: 'org.freedownloadmanager.fdm' } },
];

export const ALL_APPS = [...PLAYERS, ...DOWNLOADERS];
export const findApp = (id: string) => ALL_APPS.find((a) => a.id === id) ?? null;

export const androidPackages = ALL_APPS.flatMap((a) => (a.android ? [a.android.package] : []));

export function playStoreUrl(pkg: string) {
  return `market://details?id=${pkg}`;
}
export function playStoreWebUrl(pkg: string) {
  return `https://play.google.com/store/apps/details?id=${pkg}`;
}
export function appStoreUrl(id: string) {
  return `https://apps.apple.com/app/id${id}`;
}

/**
 * Desktop players (VLC, PotPlayer, MPC-HC, mpv) open .m3u playlists, so on the web a one-line
 * playlist is the most reliable "open in my player".
 */
export function m3uPlaylist(url: string, title: string): string {
  return `#EXTM3U\n#EXTINF:-1,${title.replace(/[\r\n]/g, ' ')}\n${url}\n`;
}
