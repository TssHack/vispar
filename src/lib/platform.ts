import { Platform } from 'react-native';

import { isDesktopApp } from '@/update/target';

import type { PlayerPlatform } from './containers';

/** `?platform=ios` previews the iOS container rules in a browser (like `?tv=1` for the TV layout). */
const previewIos =
  Platform.OS === 'web' && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('platform') === 'ios';

/** The platform as the player sees it. Read here once so the pure helpers can take it as an argument. */
export function appPlatform(): PlayerPlatform {
  if (Platform.OS === 'ios' || previewIos) return 'ios';
  if (Platform.OS === 'android') return 'android';
  return isDesktopApp ? 'desktop' : 'web';
}
