import * as Clipboard from 'expo-clipboard';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform, Share } from 'react-native';

import { toast } from '@/components/Toast';

import { ALL_APPS, appStoreUrl, m3uPlaylist, playStoreUrl, playStoreWebUrl, type ExternalApp, type ExternalKind } from './apps';

const VIEW = 'android.intent.action.VIEW';
const SEND = 'android.intent.action.SEND';

let installedCache: Set<string> | null = null;

/**
 * Android only: which known apps are installed. Uses the app icon lookup, which returns '' for
 * packages that aren't installed (needs the <queries> block added by plugins/withExternalApps.js).
 */
export async function detectInstalled(): Promise<Set<string>> {
  if (Platform.OS !== 'android') return new Set();
  if (installedCache) return installedCache;
  const found = new Set<string>();
  await Promise.all(
    ALL_APPS.map(async (app) => {
      if (!app.android) return;
      try {
        const icon = await IntentLauncher.getApplicationIconAsync(app.android.package);
        if (icon) found.add(app.id);
      } catch {
        // not installed / not visible
      }
    }),
  );
  installedCache = found;
  return found;
}

export async function appIcon(app: ExternalApp): Promise<string | null> {
  if (Platform.OS !== 'android' || !app.android) return null;
  try {
    return (await IntentLauncher.getApplicationIconAsync(app.android.package)) || null;
  } catch {
    return null;
  }
}

/** Apps that make sense on this platform, in catalogue order. */
export function appsFor(kind: ExternalKind, opts: { tv?: boolean } = {}): ExternalApp[] {
  return ALL_APPS.filter((a) => a.kind === kind && (Platform.OS === 'android' ? !!a.android && (!opts.tv || a.tv) : Platform.OS === 'ios' ? !!a.ios : false));
}

async function openStore(app: ExternalApp) {
  try {
    if (Platform.OS === 'android' && app.android) {
      await Linking.openURL(playStoreUrl(app.android.package)).catch(() => Linking.openURL(playStoreWebUrl(app.android!.package)));
    } else if (Platform.OS === 'ios' && app.ios?.appStoreId) {
      await Linking.openURL(appStoreUrl(app.ios.appStoreId));
    }
  } catch {
    // nothing else to try
  }
}

/** Opens `url` in a specific external app. Falls back to its store page when it isn't installed. */
export async function openInApp(app: ExternalApp, url: string, title: string): Promise<boolean> {
  try {
    if (Platform.OS === 'android' && app.android) {
      const send = app.android.action === 'send';
      await IntentLauncher.startActivityAsync(send ? SEND : VIEW, {
        packageName: app.android.package,
        ...(send ? { type: 'text/plain', extra: { 'android.intent.extra.TEXT': url } } : { data: url }),
        ...(app.kind === 'player' && !send ? { type: 'video/*' } : {}),
        ...(app.android.extras && !send ? { extra: app.android.extras(title) } : {}),
      });
      return true;
    }
    if (Platform.OS === 'ios' && app.ios) {
      await Linking.openURL(app.ios.url(url, title));
      return true;
    }
  } catch {
    toast(`${app.name} نصب نیست؛ صفحه‌ی دانلودش باز می‌شود`, 'download');
    await openStore(app);
  }
  return false;
}

/** System "open with" chooser for video (Android), or the platform default elsewhere. */
export async function openWithSystemPlayer(url: string, title: string) {
  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync(VIEW, { data: url, type: 'video/*', extra: { title } });
      return;
    } catch {
      // fall through
    }
  }
  if (Platform.OS === 'web') {
    downloadPlaylist(url, title);
    return;
  }
  Linking.openURL(url).catch(() => toast('برنامه‌ای برای باز کردن این لینک پیدا نشد', 'alert'));
}

/** Browser / system download manager. */
export function downloadWithSystem(url: string, title: string) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const a = document.createElement('a');
    a.href = url;
    a.download = title;
    a.rel = 'noopener';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  Linking.openURL(url).catch(() => toast('باز کردن لینک ممکن نشد', 'alert'));
}

/** Share sheet with the link, so any downloader or messenger can receive it. */
export function shareLink(url: string, title: string) {
  if (Platform.OS === 'web') {
    copyLink(url);
    return;
  }
  Share.share({ message: url, title }).catch(() => {});
}

export async function copyLink(url: string) {
  try {
    await Clipboard.setStringAsync(url);
    toast('لینک کپی شد', 'check');
  } catch {
    toast('کپی لینک ممکن نشد', 'alert');
  }
}

/** Web: a one-item .m3u opens in the desktop's default player (VLC, PotPlayer, MPC-HC, mpv). */
export function downloadPlaylist(url: string, title: string) {
  if (typeof document === 'undefined') return;
  const blob = new Blob([m3uPlaylist(url, title)], { type: 'audio/x-mpegurl' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = `${title.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'vispar'}.m3u`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
  toast('فایل پلی‌لیست دانلود شد؛ با VLC یا پلیر سیستم بازش کنید', 'download');
}
