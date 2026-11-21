import { subtitleHint } from './parse';

export type ProbeInput = {
  source: { url?: string; quality?: string } | null;
  enabled: boolean;
  autoProbe: boolean;
  /** Embedded tracks are reported by the container (native only). */
  hasEmbeddedTracks: boolean;
  /**
   * Whether the container's tracks are known yet. On native they arrive after the file loads; probing
   * before that guessed "no embedded track", fetched a sidecar, and then showed it on top of the
   * embedded track once that arrived. Always true on web, which has no embedded tracks.
   */
  tracksKnown: boolean;
  /** The user's saved choice for this title. */
  saved: { url?: string; off?: boolean };
  /** The source URL already probed in this session, if any. */
  probedFor: string | null;
};

export type ProbeAction = 'none' | 'disabled' | 'load-saved' | 'probe';

/**
 * What to do about a sidecar for the current source. Pure, so the order of the rules (which is
 * where the bugs were) can be tested directly.
 */
export function planSidecar(input: ProbeInput): ProbeAction {
  const { source, enabled, autoProbe, hasEmbeddedTracks, tracksKnown, saved, probedFor } = input;
  if (!source?.url || !enabled) return 'none';
  // Burned-in subtitles: overlaying text would double it.
  if (subtitleHint(source) === 'hard') return 'disabled';
  // An explicit "off" for this title beats everything, including a saved URL and auto-probing.
  if (saved.off) return 'disabled';
  if (saved.url) return 'load-saved';
  if (!autoProbe || probedFor === source.url) return 'none';
  // Wait for the container: an embedded track is the better answer when it exists.
  if (!tracksKnown) return 'none';
  // An embedded track is better than guessing at a sidecar name.
  if (hasEmbeddedTracks) return 'none';
  return 'probe';
}
