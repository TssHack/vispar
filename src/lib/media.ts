import { Platform } from 'react-native';

import { config } from '@/config';
import { isDesktopApp } from '@/update/target';

const isHttp = (url: string) => /^http:\/\//i.test(url);

/** An HTTPS page cannot load plain-HTTP media: the browser blocks it as mixed content. */
export function isBlockedByBrowser(url: string): boolean {
  if (Platform.OS !== 'web' || isDesktopApp || typeof window === 'undefined') return false;
  if (config.mediaBase) return false; // the relay makes it playable
  return window.location.protocol === 'https:' && isHttp(url);
}

/**
 * The URL to hand to the video element. The desktop app streams plain-HTTP files through its own
 * `app://vispar/_media` relay (served by the Electron shell on the user's machine, Range requests
 * included). Everywhere else the URL is used as is: Android and iOS are allowed cleartext traffic.
 */
export function playableUrl(url: string): string {
  if (isDesktopApp && isHttp(url)) return `app://vispar/_media?u=${encodeURIComponent(url)}`;
  if (Platform.OS === 'web' && !isDesktopApp && config.mediaBase && isHttp(url) && window.location.protocol === 'https:') return `${config.mediaBase}/stream?u=${encodeURIComponent(url)}`;
  return url;
}

/**
 * On an HTTPS page, checks whether the same file is also served over HTTPS. If the host answers
 * (valid certificate), the https:// URL can be played in the browser; otherwise returns null.
 */
export async function upgradeToHttps(url: string): Promise<string | null> {
  if (!isHttp(url)) return null;
  const https = url.replace(/^http:/i, 'https:');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    await fetch(https, { method: 'HEAD', mode: 'no-cors', signal: ctrl.signal });
    return https;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export { explainPlaybackError, type PlaybackHint } from './playbackError';
