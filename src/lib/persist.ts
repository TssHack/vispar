import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export type PersistedStore<T> = {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
  /** Resolves once the saved value has been read from storage. */
  ready: Promise<void>;
  use: <S>(selector: (state: T) => S) => S;
};

/**
 * Small global store backed by AsyncStorage. `migrate` receives whatever was saved before
 * (possibly from an older app version) and must return a complete value.
 */
export function createPersistedStore<T>(key: string, initial: T, migrate: (saved: unknown) => T = (s) => ({ ...initial, ...(s as object) })): PersistedStore<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  let writeTimer: ReturnType<typeof setTimeout> | null = null;

  const persist = () => {
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
      AsyncStorage.setItem(key, JSON.stringify(state)).catch(() => {});
    }, 150);
  };

  const ready = AsyncStorage.getItem(key)
    .then((raw) => {
      if (raw) {
        try {
          state = migrate(JSON.parse(raw));
          emit();
        } catch {
          // corrupt value: keep defaults
        }
      }
    })
    .catch(() => {});

  const store: PersistedStore<T> = {
    get: () => state,
    set: (next) => {
      state = typeof next === 'function' ? (next as (p: T) => T)(state) : next;
      emit();
      persist();
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    ready,
    use: (selector) =>
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useSyncExternalStore(store.subscribe, () => selector(state), () => selector(state)),
  };
  return store;
}
