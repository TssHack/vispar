import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Linking, Platform } from 'react-native';

import { api } from '@/api/client';
import type { GithubRelease } from '@/api/types';
import { repoUrl } from '@/config';

import { releaseTarget } from './target';
import { findUpdate, pickAsset } from './version';

const LAST_CHECK = 'vispar.update.lastCheck';
const SKIPPED = 'vispar.update.skipped';
const AUTO_INTERVAL = 12 * 60 * 60 * 1000;

export type CheckStatus = 'idle' | 'checking' | 'upToDate' | 'available' | 'error';

type UpdateContextValue = {
  currentVersion: string;
  /** This build can check GitHub releases and install from them (Android and desktop). */
  supported: boolean;
  status: CheckStatus;
  /** Newer GitHub release (a new APK). */
  release: GithubRelease | null;
  /** An over-the-air JS update was downloaded and applies on restart. */
  otaReady: boolean;
  /** The release sheet is open. */
  sheetOpen: boolean;
  lastCheckedAt: number | null;
  checkNow: (opts?: { silent?: boolean }) => Promise<void>;
  install: () => void;
  dismiss: () => void;
  skipThisVersion: () => void;
  applyOta: () => void;
};

const Ctx = createContext<UpdateContextValue | null>(null);

export const currentVersion = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0.0.0';

const target = releaseTarget();
/** Android and the desktop apps update from GitHub releases; the web build is always the latest deploy. */
const releaseChecksSupported = target !== null;
const otaSupported = Platform.OS !== 'web' && Updates.isEnabled && !__DEV__;

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CheckStatus>('idle');
  const [release, setRelease] = useState<GithubRelease | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [otaReady, setOtaReady] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const busy = useRef(false);

  const checkOta = useCallback(async () => {
    if (!otaSupported) return;
    try {
      const res = await Updates.checkForUpdateAsync();
      if (res.isAvailable) {
        const fetched = await Updates.fetchUpdateAsync();
        if (fetched.isNew) setOtaReady(true);
      }
    } catch {
      // OTA failures are non-fatal; the GitHub check still runs.
    }
  }, []);

  const checkNow = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (busy.current) return;
      busy.current = true;
      setStatus('checking');
      try {
        await checkOta();
        if (!releaseChecksSupported) {
          setStatus('upToDate');
          return;
        }
        const releases = await api.releases();
        const next = findUpdate(releases, currentVersion);
        const now = Date.now();
        setLastCheckedAt(now);
        AsyncStorage.setItem(LAST_CHECK, String(now)).catch(() => {});
        if (!next) {
          setRelease(null);
          setStatus('upToDate');
          return;
        }
        setRelease(next);
        setStatus('available');
        const skipped = await AsyncStorage.getItem(SKIPPED).catch(() => null);
        // A manual check always shows the sheet; an automatic one respects "skip this version".
        if (!silent || skipped !== next.tagName) setSheetOpen(true);
      } catch {
        setStatus('error');
      } finally {
        busy.current = false;
      }
    },
    [checkOta],
  );

  // Automatic check on launch and when the app returns to the foreground, at most every 12h.
  useEffect(() => {
    const maybeCheck = async () => {
      const last = Number((await AsyncStorage.getItem(LAST_CHECK).catch(() => null)) ?? 0);
      if (last) setLastCheckedAt(last);
      if (Date.now() - last > AUTO_INTERVAL) checkNow({ silent: true });
      else checkOta();
    };
    maybeCheck();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') maybeCheck();
    });
    return () => sub.remove();
  }, [checkNow, checkOta]);

  const install = useCallback(() => {
    const asset = release && target ? pickAsset(release, target) : null;
    const url = asset?.url ?? release?.htmlUrl ?? `${repoUrl}/releases/latest`;
    Linking.openURL(url).catch(() => {});
  }, [release]);

  const value = useMemo<UpdateContextValue>(
    () => ({
      currentVersion,
      supported: releaseChecksSupported,
      status,
      release,
      otaReady,
      sheetOpen,
      lastCheckedAt,
      checkNow,
      install,
      dismiss: () => setSheetOpen(false),
      skipThisVersion: () => {
        if (release) AsyncStorage.setItem(SKIPPED, release.tagName).catch(() => {});
        setSheetOpen(false);
      },
      applyOta: () => {
        Updates.reloadAsync().catch(() => {});
      },
    }),
    [status, release, otaReady, sheetOpen, lastCheckedAt, checkNow, install],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUpdates() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUpdates must be used inside UpdateProvider');
  return ctx;
}
