/**
 * Choosing an embedded subtitle track. Pure, so the rules can be tested without a player.
 *
 * `expo-video` reports tracks on Android and iOS. Android normalises the container's language tag
 * (`per`, `fas` → `fa`), but releases are often tagged wrongly or vaguely, and the human-readable
 * `name` ("Farsi", "فارسی", "Persian SDH") is then the only reliable signal.
 */

export type TrackInfo = {
  id: string;
  language: string;
  /** Device-language display name, built by the platform from `language`. */
  label: string;
  /** Name stored in the container, if any. */
  name?: string;
  isDefault?: boolean;
};

export type LanguagePreference = 'auto' | 'fa' | 'en';

const PERSIAN = /^(fa|per|fas)\b|farsi|persian|فارسی|پارسی/i;
const ENGLISH = /^(en|eng)\b|english|انگلیسی/i;

const matches = (track: TrackInfo, re: RegExp): boolean => [track.language, track.name ?? '', track.label].some((v) => re.test(v.trim()));

export const isPersianTrack = (track: TrackInfo): boolean => matches(track, PERSIAN);

/**
 * The track to show when a source starts, or null for none.
 *
 * Order: the language the user picked for this title before, then the preferred language (a track
 * flagged default wins among matches), then the container's default track, then the first track.
 */
export function pickTrack(tracks: TrackInfo[], preference: LanguagePreference, savedLanguage?: string): TrackInfo | null {
  if (!tracks.length) return null;
  if (savedLanguage) {
    const saved = tracks.find((t) => t.language === savedLanguage);
    if (saved) return saved;
  }
  if (preference !== 'auto') {
    const wanted = tracks.filter((t) => matches(t, preference === 'fa' ? PERSIAN : ENGLISH));
    if (wanted.length) return wanted.find((t) => t.isDefault) ?? wanted[0]!;
  }
  return tracks.find((t) => t.isDefault) ?? tracks[0]!;
}

/** Menu label: the container's own name when it has one ("Farsi SDH"), else the platform label. */
export const trackLabel = (track: TrackInfo): string => (track.name?.trim() || track.label || track.language).trim();

/**
 * A subtitle link the user pasted, cleaned up, or null when it cannot be one. Accepts any http(s) URL
 * (hosts often serve `.srt` behind a script URL); the loader then checks that the content parses.
 */
export function subtitleLinkFrom(text: string): string | null {
  const first = text.trim().split(/\s+/)[0] ?? '';
  if (!/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(first)) return null;
  try {
    return new URL(first).toString();
  } catch {
    return null;
  }
}
