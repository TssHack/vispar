import { createPersistedStore } from '@/lib/persist';

/**
 * Per-title subtitle choices, remembered so the user is asked once.
 *
 * Kept apart from `settingsStore` because this grows with the library rather than with preference:
 * mixing hundreds of title keys into the settings blob would make every settings write rewrite them.
 */

export type SubtitleChoice = {
  /** Explicit URL the user supplied, if any. */
  url?: string;
  /** Language of the chosen track, for embedded tracks. */
  language?: string;
  /** Sync correction in milliseconds. */
  offsetMs?: number;
  /** The user turned subtitles off for this title specifically. */
  off?: boolean;
};

export type SubtitleLibrary = Record<string, SubtitleChoice>;

/** Oldest entries are dropped past this, so the store cannot grow without bound. */
const MAX_ENTRIES = 500;

export const subtitleStore = createPersistedStore<SubtitleLibrary>('vispar.subtitles', {}, (saved) => {
  if (!saved || typeof saved !== 'object') return {};
  const out: SubtitleLibrary = {};
  for (const [key, value] of Object.entries(saved as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    out[key] = {
      url: typeof v.url === 'string' && v.url ? v.url : undefined,
      language: typeof v.language === 'string' && v.language ? v.language : undefined,
      offsetMs: typeof v.offsetMs === 'number' && Number.isFinite(v.offsetMs) ? Math.max(-30_000, Math.min(30_000, v.offsetMs)) : undefined,
      off: v.off === true ? true : undefined,
    };
  }
  return out;
});

/** Stable key for a title, including the episode when there is one. */
export function subtitleKey(type: string | undefined, id: number, episodeId?: number): string | null {
  if (!type || !id) return null;
  return episodeId ? `${type}:${id}:${episodeId}` : `${type}:${id}`;
}

export const getSubtitleChoice = (key: string): SubtitleChoice => subtitleStore.get()[key] ?? {};

export function setSubtitleChoice(key: string, patch: SubtitleChoice): void {
  subtitleStore.set((all) => {
    // Re-insert the key so it moves to the end: object order is our only age signal, and a title that
    // is used every day must not look like the oldest one.
    const { [key]: previous, ...rest } = all;
    const next: SubtitleLibrary = { ...rest, [key]: { ...previous, ...patch } };
    const keys = Object.keys(next);
    if (keys.length > MAX_ENTRIES) {
      // Keys carry no timestamp; insertion order is the closest proxy for age that we have.
      for (const stale of keys.slice(0, keys.length - MAX_ENTRIES)) delete next[stale];
    }
    return next;
  });
}

/**
 * One shared empty value. `useSyncExternalStore` calls the selector on every render and compares the
 * results by identity, so returning a fresh `{}` for "no saved choice" made React see a new snapshot
 * each time and loop ("Maximum update depth exceeded", React error #185), which blanked the player.
 */
const NO_CHOICE: SubtitleChoice = Object.freeze({});

/** The selector behind `useSubtitleChoice`; exported so the identity guarantee has a test. */
export const selectChoice = (all: SubtitleLibrary, key: string | null): SubtitleChoice => (key ? (all[key] ?? NO_CHOICE) : NO_CHOICE);

export const useSubtitleChoice = (key: string | null): SubtitleChoice => subtitleStore.use((all) => selectChoice(all, key));
