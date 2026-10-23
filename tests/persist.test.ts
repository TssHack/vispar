import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setItem = vi.fn(async (_k: string, _v: string) => undefined);
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async () => null, setItem: (k: string, v: string) => setItem(k, v) } }));

import { createPersistedStore, flushAllStores } from '@/lib/persist';

describe('persisted store flushing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setItem.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('debounces writes, then writes the latest value once', async () => {
    const s = createPersistedStore<{ n: number }>('t.debounce', { n: 0 });
    s.set({ n: 1 });
    s.set({ n: 2 });
    expect(setItem).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith('t.debounce', JSON.stringify({ n: 2 }));
  });

  it('flush writes a pending change immediately and cancels the timer (no second write)', async () => {
    const s = createPersistedStore<{ n: number }>('t.flush', { n: 0 });
    s.set({ n: 5 });
    await s.flush();
    expect(setItem).toHaveBeenCalledWith('t.flush', JSON.stringify({ n: 5 }));
    await vi.advanceTimersByTimeAsync(500);
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('flush with nothing pending writes nothing', async () => {
    const s = createPersistedStore<{ n: number }>('t.idle', { n: 0 });
    await s.flush();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('flushAllStores flushes every store', async () => {
    const a = createPersistedStore<{ a: number }>('t.a', { a: 0 });
    const b = createPersistedStore<{ b: number }>('t.b', { b: 0 });
    a.set({ a: 1 });
    b.set({ b: 2 });
    await flushAllStores();
    const keys = setItem.mock.calls.map((c) => c[0]);
    expect(keys).toContain('t.a');
    expect(keys).toContain('t.b');
  });
});
