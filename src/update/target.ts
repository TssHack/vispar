import { Platform } from 'react-native';

import type { ReleaseTarget } from './version';

/** True inside the Electron desktop shell (it adds "Electron/x" to the user agent). */
export const isDesktopApp = Platform.OS === 'web' && typeof navigator !== 'undefined' && /Electron\//.test(navigator.userAgent);

/**
 * Which installer this build can update itself with. Plain browsers and iOS return null:
 * the web app is always the latest deploy, and iOS cannot sideload.
 */
export function releaseTarget(): ReleaseTarget | null {
  if (Platform.OS === 'android') return 'android';
  if (!isDesktopApp) return null;
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'mac';
  return 'linux';
}

export const TARGET_LABEL: Record<ReleaseTarget, string> = { android: 'اندروید', windows: 'ویندوز', mac: 'مک', linux: 'لینوکس' };
