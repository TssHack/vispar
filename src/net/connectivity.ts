import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import { config } from '@/config';

/**
 * - checking: probe in flight
 * - online:   internet works and the catalog API answered
 * - offline:  no internet at all
 * - server:   internet works but the catalog API is unreachable
 */
export type NetStatus = 'checking' | 'online' | 'offline' | 'server';

/** Which step of the probe is running (shown on the splash). */
export type NetPhase = 'internet' | 'server' | 'done';

type State = { status: NetStatus; checkedAt: number; phase: NetPhase };

let state: State = { status: 'checking', checkedAt: 0, phase: 'internet' };
const listeners = new Set<() => void>();
const set = (status: NetStatus, phase: NetPhase = 'done') => {
  const same = state.status === status && state.phase === phase;
  state = { status, checkedAt: Date.now(), phase };
  if (!same || status === 'checking') listeners.forEach((l) => l());
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

/**
 * Is the content server answering? Asks its tiny `/health` endpoint instead of downloading a
 * catalog page: any HTTP answer below 500 proves the server is up (a proxy without `/health`
 * simply says 404), so a slow link or a big upstream response cannot make the splash fail.
 */
async function apiReachable(): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(`${config.apiBase}/health`, { headers: { Accept: 'application/json' }, signal: ctrl.signal, cache: 'no-store' });
    return res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

let inflight: Promise<NetStatus> | null = null;

/** Runs the two-step probe (internet, then API). Concurrent calls share one run. */
export function checkConnection(): Promise<NetStatus> {
  if (inflight) return inflight;
  if (state.status !== 'online') set('checking', 'internet');
  inflight = (async () => {
    const net = await hasInternet();
    if (!net) return 'offline' as const;
    if (state.status === 'checking') set('checking', 'server');
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
export const usePhase = (): NetPhase => useSyncExternalStore(subscribeNet, () => state.phase, () => state.phase);
export const useNetStatus = (): NetStatus =>
  useSyncExternalStore(subscribeNet, () => state.status, () => state.status);
