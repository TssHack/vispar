import { AppState, Platform } from 'react-native';

import { flushAllStores } from './persist';

let started = false;

/**
 * Writes pending store changes when the app is about to stop running: backgrounded or inactive on
 * native, hidden or closed on the web. The stores debounce their writes, and a debounced write that
 * has not fired when the process is killed is lost (the last watch position, a just-toggled setting).
 */
export function startPersistLifecycle() {
  if (started) return;
  started = true;
  AppState.addEventListener('change', (s) => {
    if (s !== 'active') void flushAllStores();
  });
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => void flushAllStores());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flushAllStores();
    });
  }
}
