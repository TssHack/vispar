import { createPersistedStore } from '@/lib/persist';

export type AccentName = 'amber' | 'coral' | 'teal' | 'violet' | 'rose';
export type Density = 'compact' | 'normal' | 'large';
export type QualityPref = 'best' | '2160' | '1080' | '720' | '480';
export type DigitStyle = 'fa' | 'en';

/** 'internal' = Vispar's player, 'ask' = show the chooser every time, otherwise an external app id. */
export type PlayerMode = 'internal' | 'ask' | (string & {});
/** 'ask' = chooser, 'system' = browser / system download manager, otherwise an external app id. */
export type DownloaderMode = 'ask' | 'system' | (string & {});

export type HomeSections = {
  continueWatching: boolean;
  myList: boolean;
  topRated: boolean;
  movies: boolean;
  series: boolean;
  genres: boolean;
};

export type Settings = {
  accent: AccentName;
  density: Density;
  digits: DigitStyle;
  reduceMotion: boolean;
  showRatings: boolean;
  defaultQuality: QualityPref;
  playerMode: PlayerMode;
  downloaderMode: DownloaderMode;
  autoplayNext: boolean;
  /** Resume where you left off without asking. */
  autoResume: boolean;
  skipSeconds: 10 | 15 | 30;
  home: HomeSections;
};

export const DEFAULT_SETTINGS: Settings = {
  accent: 'amber',
  density: 'normal',
  digits: 'fa',
  reduceMotion: false,
  showRatings: true,
  defaultQuality: 'best',
  playerMode: 'internal',
  downloaderMode: 'ask',
  autoplayNext: true,
  autoResume: false,
  skipSeconds: 10,
  home: { continueWatching: true, myList: true, topRated: true, movies: true, series: true, genres: true },
};

/** Accepts settings saved by any earlier version (including v2.0's `externalPlayer` flag). */
export function migrateSettings(saved: unknown): Settings {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>;
  const out: Settings = { ...DEFAULT_SETTINGS, ...(s as Partial<Settings>), home: { ...DEFAULT_SETTINGS.home, ...((s.home as object) ?? {}) } };
  if (s.externalPlayer === true && !('playerMode' in s)) out.playerMode = 'ask';
  if (![10, 15, 30].includes(out.skipSeconds)) out.skipSeconds = 10;
  return out;
}

export const settingsStore = createPersistedStore<Settings>('vispar.prefs', DEFAULT_SETTINGS, migrateSettings);

export const getSettings = settingsStore.get;
export const useSetting = <K extends keyof Settings>(key: K): Settings[K] => settingsStore.use((s) => s[key]);
export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  settingsStore.set((s) => ({ ...s, [key]: value }));
}
export function setHomeSection(key: keyof HomeSections, value: boolean) {
  settingsStore.set((s) => ({ ...s, home: { ...s.home, [key]: value } }));
}
