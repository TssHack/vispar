import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import { buildUrl, fetchJson } from '@/api/client';

/**
 * - checking: probe in flight
 * - online:   internet works and the catalog API answered
 * - offline:  no internet at all
 * - server:   internet works but the catalog API is unreachable
 */
export type NetStatus = 'checking' | 'online' | 'offline' | 'server';

type State = { status: NetStatus; checkedAt: number };

let state: State = { status: 'checking', checkedAt: 0 };
const listeners = new Set<() => void>();
const set = (status: NetStatus) => {
  if (state.status === status && status !== 'checking') {
    state = { status, checkedAt: Date.now() };
    return;
  }
  state = { status, checkedAt: Date.now() };
  listeners.forEach((l) => l());
};

/** Small, CORS-free endpoints that answer with an empty body. Any one answering means we are online. */
const INTERNET_PROBES = ['https://www.gstatic.com/generate_204', 'https://cp.cloudflare.com/generate_204'];

async function reach(url: string, ms: number): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function hasInternet(ms = 4500): Promise<boolean> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  const results = await Promise.all(INTERNET_PROBES.map((u) => reach(u, ms)));
  return results.some(Boolean);
}

async function apiReachable(): Promise<boolean> {
  try {
    await fetchJson(buildUrl(['movie', 'by', 'filtres', 0, 'created', 0]), { timeoutMs: 9000 });
    return true;
  } catch {
    return false;
  }
}

let inflight: Promise<NetStatus> | null = null;

/** Runs the two-step probe (internet, then API). Concurrent calls share one run. */
export function checkConnection(): Promise<NetStatus> {
  if (inflight) return inflight;
  if (state.status !== 'online') set('checking');
  inflight = (async () => {
    const net = await hasInternet();
    if (!net) return 'offline' as const;
    return (await apiReachable()) ? ('online' as const) : ('server' as const);
  })()
    .then((s) => {
      set(s);
      return s;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Called when a request fails in a way that suggests the connection dropped. */
export function reportFailure() {
  if (state.status === 'online') void checkConnection();
}

let monitoring = false;
/** Re-checks on network events, when the app returns to the foreground, and while not online. */
export function startMonitor() {
  if (monitoring) return;
  monitoring = true;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('online', () => void checkConnection());
    window.addEventListener('offline', () => set('offline'));
  }
  AppState.addEventListener('change', (s) => {
    if (s === 'active') void checkConnection();
  });
  setInterval(() => {
    if (state.status === 'offline' || state.status === 'server') void checkConnection();
  }, 8000);
}

export const getNet = () => state;
export const subscribeNet = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useNetStatus = (): NetStatus =>
  useSyncExternalStore(subscribeNet, () => state.status, () => state.status);
