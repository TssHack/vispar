import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { createPersistedStore } from '@/lib/persist';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

/** iPhone, iPod and iPad (iPadOS 13+ reports itself as a Mac with touch). */
export function detectIOS(): boolean {
  if (!isWeb) return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

export function detectIPad(): boolean {
  if (!isWeb) return false;
  return /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function detectStandalone(): boolean {
  if (!isWeb) return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

// ---------- install prompt capture (Chromium / Edge / Android) ----------

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const pwaStore = createPersistedStore<{ dismissedAt: number; neverAsk: boolean }>('vispar.pwa', { dismissedAt: 0, neverAsk: false });

let started = false;
export function startInstallCapture() {
  if (!isWeb || started) return;
  started = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    emit();
  });
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const evt = deferred;
  deferred = null;
  emit();
  await evt.prompt();
  const choice = await evt.userChoice.catch(() => null);
  return choice?.outcome === 'accepted';
}

export type InstallKind = 'none' | 'ios' | 'prompt';

/** What the browser can do to put the app on the home screen right now. */
export function useInstallKind(): InstallKind {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (!isWeb || detectStandalone() ? 'none' : detectIOS() ? 'ios' : deferred ? 'prompt' : 'none'),
    () => 'none',
  );
}

// ---------- iOS guide visibility ----------

let guideOpen = false;
const guideListeners = new Set<() => void>();
export function openInstallGuide() {
  guideOpen = true;
  guideListeners.forEach((l) => l());
}
export function closeInstallGuide() {
  guideOpen = false;
  guideListeners.forEach((l) => l());
}
export const useGuideOpen = () =>
  useSyncExternalStore(
    (l) => {
      guideListeners.add(l);
      return () => guideListeners.delete(l);
    },
    () => guideOpen,
    () => false,
  );

export const WEEK = 7 * 24 * 60 * 60 * 1000;
