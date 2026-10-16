import * as RN from 'react-native';

export type RemoteKey = 'select' | 'left' | 'right' | 'up' | 'down' | 'playPause' | 'play' | 'pause' | 'rewind' | 'fastForward' | 'menu' | 'longSelect' | 'unknown';

type TVEvent = { eventType?: string; eventKeyAction?: number };

/**
 * Remote-control keys on Android TV (D-pad, media keys). `useTVEventHandler` only exists in the
 * react-native-tvos fork, so on the stock runtime this is a no-op and nothing breaks.
 * Fires once per key press (the TV runtime reports both key-down and key-up).
 */
export function useRemote(onKey: (key: RemoteKey) => void, enabled = true) {
  const hook = (RN as unknown as { useTVEventHandler?: (h: (e: TVEvent) => void) => void }).useTVEventHandler;
  if (!hook) return;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  hook((e) => {
    if (!enabled || !e?.eventType) return;
    if (e.eventKeyAction === 1) return; // key up
    onKey((e.eventType as RemoteKey) ?? 'unknown');
  });
}
