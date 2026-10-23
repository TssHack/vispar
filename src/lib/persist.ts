import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export type PersistedStore<T> = {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
  /** Resolves once the saved value has been read from storage. */
  ready: Promise<void>;
  /** Writes a pending change now instead of waiting for the debounce. A no-op when nothing is pending. */
  flush: () => Promise<void>;
  use: <S>(selector: (state: T) => S) => S;
};

const WRITE_DELAY_MS = 150;
const registry = new Set<() => Promise<void>>();

/** Flushes every store's pending write. Called when the app goes to the background or the page is hidden. */
export function flushAllStores(): Promise<void[]> {
  return Promise.all([...registry].map((flush) => flush()));
}

/**
 * Small global store backed by AsyncStorage. `migrate` receives whatever was saved before
 * (possibly from an older app version) and must return a complete value.
 */
export function createPersistedStore<T>(key: string, initial: T, migrate: (saved: unknown) => T = (s) => ({ ...initial, ...(s as object) })): PersistedStore<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  let writeTimer: ReturnType<typeof setTimeout> | null = null;

  const write = () => AsyncStorage.setItem(key, JSON.stringify(state)).catch(() => {});

  const persist = () => {
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
      writeTimer = null;
      void write();
    }, WRITE_DELAY_MS);
  };

  const flush = async () => {
    if (!writeTimer) return; // nothing pending: do not overwrite storage with an unchanged (or not yet loaded) value
    clearTimeout(writeTimer);
    writeTimer = null;
    await write();
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
    flush,
    use: (selector) =>
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useSyncExternalStore(store.subscribe, () => selector(state), () => selector(state)),
  };
  registry.add(flush);
  return store;
}
