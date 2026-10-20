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
    const next: SubtitleLibrary = { ...all, [key]: { ...all[key], ...patch } };
    const keys = Object.keys(next);
    if (keys.length > MAX_ENTRIES) {
      // Keys carry no timestamp; insertion order is the closest proxy for age that we have.
      for (const stale of keys.slice(0, keys.length - MAX_ENTRIES)) delete next[stale];
    }
    return next;
  });
}

export const useSubtitleChoice = (key: string | null): SubtitleChoice =>
  subtitleStore.use((all) => (key ? (all[key] ?? {}) : {}));
