import { Platform } from 'react-native';

import { isDesktopApp } from '@/update/target';

const isHttp = (url: string) => /^http:\/\//i.test(url);

/** An HTTPS page cannot load plain-HTTP media: the browser blocks it as mixed content. */
export function isBlockedByBrowser(url: string): boolean {
  if (Platform.OS !== 'web' || isDesktopApp || typeof window === 'undefined') return false;
  return window.location.protocol === 'https:' && isHttp(url);
}

/**
 * The URL to hand to the video element. The desktop app streams plain-HTTP files through its own
 * `app://vispar/_media` relay (served by the Electron shell on the user's machine, Range requests
 * included). Everywhere else the URL is used as is: Android and iOS are allowed cleartext traffic.
 */
export function playableUrl(url: string): string {
  if (isDesktopApp && isHttp(url)) return `app://vispar/_media?u=${encodeURIComponent(url)}`;
  return url;
}
