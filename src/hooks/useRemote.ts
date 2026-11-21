import { useCallback, useRef } from 'react';
import * as RN from 'react-native';

import { remoteKeyFrom, type RemoteKey, type RemoteState, type TVEvent } from '@/lib/remoteKeys';

export type { RemoteKey } from '@/lib/remoteKeys';

/**
 * Remote-control keys on Android TV (D-pad, media keys). `useTVEventHandler` only exists in the
 * react-native-tvos fork, so on the stock runtime this is a no-op and nothing breaks.
 */
export function useRemote(onKey: (key: RemoteKey) => void, enabled = true) {
  // The fork re-subscribes whenever the handler changes; keep one stable handler and read the
  // latest callback through a ref, so a re-render cannot drop a key between unsubscribe and subscribe.
  const latest = useRef({ onKey, enabled });
  latest.current = { onKey, enabled };
  const state = useRef<RemoteState>({ sawKeyDown: false });
  const handler = useCallback((e: TVEvent) => {
    const key = remoteKeyFrom(e, state.current);
    if (key && latest.current.enabled) latest.current.onKey(key);
  }, []);
  const hook = (RN as unknown as { useTVEventHandler?: (h: (e: TVEvent) => void) => void }).useTVEventHandler;
  if (!hook) return;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  hook(handler);
}
