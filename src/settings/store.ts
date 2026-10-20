import { createPersistedStore } from '@/lib/persist';

export type AccentName = 'amber' | 'coral' | 'teal' | 'violet' | 'rose';
export type Density = 'compact' | 'normal' | 'large';
export type QualityPref = 'best' | '2160' | '1080' | '720' | '480';
export type DigitStyle = 'fa' | 'en';
export type VideoFit = 'contain' | 'cover' | 'fill';
export type SubtitleSize = 'sm' | 'md' | 'lg';
export type SubtitleBackground = 'none' | 'soft' | 'solid';
export type SubtitleLanguage = 'auto' | 'fa' | 'en';

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
  /** How video fills the screen: fit, crop to fill, or stretch. */
  videoFit: VideoFit;
  /** Home slider moves on its own. */
  heroAuto: boolean;
  /** Local alert when new movies or series show up. */
  notifyNewContent: boolean;
  /** Local alert when a series in my list gets new episodes. */
  notifyEpisodes: boolean;
  /** Subtitles shown by default when a track exists. */
  subtitlesEnabled: boolean;
  /** Which track to prefer automatically. `auto` takes the first one the file offers. */
  subtitleLanguage: SubtitleLanguage;
  subtitleSize: SubtitleSize;
  subtitleBackground: SubtitleBackground;
  /** Look for `<same-name>.srt` next to the video when the file has no embedded track. */
  subtitleAutoProbe: boolean;
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
  videoFit: 'contain',
  heroAuto: true,
  notifyNewContent: false,
  notifyEpisodes: true,
  subtitlesEnabled: true,
  subtitleLanguage: 'fa',
  subtitleSize: 'md',
  subtitleBackground: 'soft',
  subtitleAutoProbe: true,
  home: { continueWatching: true, myList: true, topRated: true, movies: true, series: true, genres: true },
};

/** Accepts settings saved by any earlier version (including v2.0's `externalPlayer` flag). */
export function migrateSettings(saved: unknown): Settings {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>;
  const out: Settings = { ...DEFAULT_SETTINGS, ...(s as Partial<Settings>), home: { ...DEFAULT_SETTINGS.home, ...((s.home as object) ?? {}) } };
  if (s.externalPlayer === true && !('playerMode' in s)) out.playerMode = 'ask';
  if (![10, 15, 30].includes(out.skipSeconds)) out.skipSeconds = 10;
  if (!['contain', 'cover', 'fill'].includes(out.videoFit)) out.videoFit = 'contain';
  // Subtitle settings arrived in 2.3; an older blob has none of them, and a hand-edited or corrupt
  // value must fall back rather than reach the renderer.
  if (typeof out.subtitlesEnabled !== 'boolean') out.subtitlesEnabled = DEFAULT_SETTINGS.subtitlesEnabled;
  if (!['auto', 'fa', 'en'].includes(out.subtitleLanguage)) out.subtitleLanguage = DEFAULT_SETTINGS.subtitleLanguage;
  if (!['sm', 'md', 'lg'].includes(out.subtitleSize)) out.subtitleSize = DEFAULT_SETTINGS.subtitleSize;
  if (!['none', 'soft', 'solid'].includes(out.subtitleBackground)) out.subtitleBackground = DEFAULT_SETTINGS.subtitleBackground;
  if (typeof out.subtitleAutoProbe !== 'boolean') out.subtitleAutoProbe = DEFAULT_SETTINGS.subtitleAutoProbe;
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
