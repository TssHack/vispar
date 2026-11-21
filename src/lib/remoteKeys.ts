/**
 * Remote-control key decoding, kept free of react-native imports so it runs in unit tests.
 */

export type RemoteKey = 'select' | 'left' | 'right' | 'up' | 'down' | 'playPause' | 'play' | 'pause' | 'rewind' | 'fastForward' | 'menu' | 'unknown';

export type TVEvent = { eventType?: string; eventKeyAction?: number };

const KEYS = new Set<RemoteKey>(['select', 'left', 'right', 'up', 'down', 'playPause', 'play', 'pause', 'rewind', 'fastForward', 'menu']);

/** Tracks whether this device sends key-down events at all; see `remoteKeyFrom`. */
export type RemoteState = { sawKeyDown: boolean };

/**
 * Turns one `useTVEventHandler` event into at most one key press. Pure, so the rules are tested.
 *
 * On Android the TV fork sends key-DOWN events only when `ReactFeatureFlags.enableKeyDownEvents` is
 * on, and it is off by default: a normal press arrives as a single key-UP (`eventKeyAction: 1`). The
 * first version of this hook dropped key-ups, which silently dropped every key on Android TV. Now a
 * press counts on key-down when the device sends key-downs, and on key-up otherwise, never both.
 * Holding a key sends `longRight`, `longLeft`, ... repeatedly while held; each counts as one more
 * press, and the final long key-up is ignored. Focus/blur notifications (`eventKeyAction: -1`) are
 * not key presses.
 */
export function remoteKeyFrom(e: TVEvent | null | undefined, state: RemoteState): RemoteKey | null {
  const type = e?.eventType;
  if (!type) return null;
  const action = e.eventKeyAction;
  if (type.startsWith('long')) {
    if (action === 1) return null; // end of a long press: the repeats already counted
    const base = (type.charAt(4).toLowerCase() + type.slice(5)) as RemoteKey;
    return KEYS.has(base) ? base : null;
  }
  if (!KEYS.has(type as RemoteKey)) return null;
  if (action === 0) {
    state.sawKeyDown = true;
    return type as RemoteKey;
  }
  if (action === 1) return state.sawKeyDown ? null : (type as RemoteKey);
  return null;
}
