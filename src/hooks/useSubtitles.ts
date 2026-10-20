import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type { Source } from '@/api/types';
import { getSubtitleChoice, setSubtitleChoice, useSubtitleChoice } from '@/lib/subtitles/store';
import { loadSubtitle, probeSidecar } from '@/lib/subtitles/load';
import { subtitleHint, type Cue } from '@/lib/subtitles/parse';
import { useSetting } from '@/settings/store';

/**
 * One place that decides which subtitles are showing and how.
 *
 * The player stays responsible for video, this hook for text. Two sources feed it:
 * - **Embedded tracks** (Android/iOS only): `expo-video` reports them and can display them natively,
 *   so we only select the track and remember the choice.
 * - **Sidecar files** (every platform, including web): fetched, parsed and rendered by our own
 *   overlay, which is the only path that works in a browser.
 */

/** `expo-video` reports tracks only on native; the web build stubs the API out. */
const NATIVE_TRACKS = Platform.OS === 'android' || Platform.OS === 'ios';

export type SubtitleState = {
  /** Embedded tracks the container reports. Empty on web. */
  tracks: { id: string; label: string; language: string }[];
  /** Language of the selected embedded track, or null when none is showing. */
  activeTrack: string | null;
  /** Sidecar cues currently loaded, if any. */
  cues: Cue[];
  /** Where the loaded sidecar came from, for the menu label. */
  sidecarUrl: string | null;
  /** Human-readable status for the menu: loading, not found, or the reason we show nothing. */
  status: 'idle' | 'loading' | 'ready' | 'missing' | 'disabled';
  offsetMs: number;
  selectTrack: (track: { id: string; language: string } | null) => void;
  /** Turns off both the embedded track and any loaded sidecar, and remembers it for this title. */
  setSidecarOff: () => void;
  /** Load a specific URL the user supplied, and remember it for this title. */
  loadFromUrl: (url: string) => Promise<boolean>;
  /** Try the conventional sidecar names next to the video. */
  probe: () => void;
  setOffset: (offsetMs: number) => void;
};

export function useSubtitles(options: {
  /** Stable key for this title or episode; null disables persistence. */
  key: string | null;
  /** The source being played, used to find a sidecar. */
  source: Source | null;
  /** The resolved title, kept for diagnostics; the menu uses it when a track has no label. */
  title: string;
  player: { availableSubtitleTracks: { id?: string; label: string; language: string }[]; subtitleTrack: unknown };
}): SubtitleState {
  const { key, source, player } = options;
  const enabled = useSetting('subtitlesEnabled');
  const preferredLanguage = useSetting('subtitleLanguage');
  const autoProbe = useSetting('subtitleAutoProbe');
  const saved = useSubtitleChoice(key);

  const [cues, setCues] = useState<Cue[]>([]);
  const [sidecarUrl, setSidecarUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<SubtitleState['status']>('idle');
  const [offsetMs, setOffsetState] = useState<number>(saved.offsetMs ?? 0);

  // Re-read the per-title choice when the key changes; the hook survives quality switches.
  useEffect(() => {
    setOffsetState(getSubtitleChoice(key ?? '').offsetMs ?? 0);
  }, [key]);

  // Track list changes as the media loads, and `availableSubtitleTracks` is not a React value, so it
  // has to be lifted into state through the event expo-video emits.
  const [tracks, setTracks] = useState<SubtitleState['tracks']>([]);
  const prevTracks = useRef('');
  const syncTracks = useCallback(() => {
    if (!NATIVE_TRACKS) return;
    const list = (player.availableSubtitleTracks ?? []).map((track, index) => ({
      id: track.id ?? String(index),
      label: track.label,
      language: track.language,
    }));
    const fingerprint = list.map((t) => `${t.id}:${t.language}`).join('|');
    if (fingerprint !== prevTracks.current) {
      prevTracks.current = fingerprint;
      setTracks(list);
    }
  }, [player]);

  useEffect(() => {
    syncTracks();
  }, [syncTracks, source?.url]);

  const [activeTrack, setActiveTrack] = useState<string | null>(null);

  /** Picks the track matching the user's language preference, or the first one. */
  const bestTrack = useMemo(() => {
    if (!tracks.length) return null;
    if (preferredLanguage === 'auto') return tracks[0] ?? null;
    const wanted = preferredLanguage === 'fa' ? ['fa', 'per', 'fas'] : ['en', 'eng'];
    return tracks.find((t) => wanted.some((code) => t.language.toLowerCase().startsWith(code))) ?? tracks[0] ?? null;
  }, [tracks, preferredLanguage]);

  const selectTrack = useCallback(
    (track: { id: string; language: string } | null) => {
      if (!NATIVE_TRACKS) return;
      const match = track ? (player.availableSubtitleTracks ?? []).find((t, i) => (t.id ?? String(i)) === track.id) : null;
      // Assigning null clears the overlay; assigning a track not from this array crashes natively,
      // which is why the match is looked up in the live array rather than in our copy of it.
      player.subtitleTrack = match ?? null;
      setActiveTrack(track ? track.id : null);
      if (key) setSubtitleChoice(key, { language: track?.language, off: track ? undefined : true });
    },
    [player, key],
  );

  // Default selection once per source: only when enabled, only on native, and never over the user's
  // explicit "off" for this title.
  const autoSelected = useRef<string | null>(null);
  useEffect(() => {
    if (!NATIVE_TRACKS || !enabled || !bestTrack || !source?.url) return;
    if (autoSelected.current === source.url) return;
    if (saved.off) return;
    autoSelected.current = source.url;
    selectTrack(bestTrack);
  }, [bestTrack, enabled, source?.url, saved.off, selectTrack]);

  const loadFromUrl = useCallback(
    async (url: string) => {
      setStatus('loading');
      const result = await loadSubtitle(url);
      if (!result.ok) {
        setStatus('missing');
        return false;
      }
      setCues(result.cues);
      setSidecarUrl(result.url);
      setStatus('ready');
      if (key) setSubtitleChoice(key, { url: result.url, off: false });
      return true;
    },
    [key],
  );

  /**
   * Sidecar discovery. Skipped when the file is known to have burned-in subtitles (overlaying text
   * would double it), and skipped on native when an embedded track already covers the case.
   */
  const probedFor = useRef<string | null>(null);
  const probe = useCallback(() => {
    if (!source?.url || !enabled) return;
    if (subtitleHint(source) === 'hard') {
      setStatus('disabled');
      return;
    }
    if (saved.url) {
      void loadFromUrl(saved.url);
      return;
    }
    if (!autoProbe || probedFor.current === source.url) return;
    // An embedded track is strictly better than a guess at a sidecar name: skip the network when the
    // container already provides subtitles.
    if (NATIVE_TRACKS && tracks.length) return;
    probedFor.current = source.url;
    setStatus('loading');
    void probeSidecar(source.url).then((result) => {
      if (result.ok) {
        setCues(result.cues);
        setSidecarUrl(result.url);
        setStatus('ready');
      } else {
        setStatus('missing');
      }
    });
  }, [source, enabled, autoProbe, tracks.length, saved.url, loadFromUrl]);

  // Keyed on the source URL, not on `probe`: depending on the callback would re-run whenever the
  // track list settles, which is exactly the moment we do not want another network request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => probe(), [source?.url, enabled, autoProbe, saved.url, tracks.length]);

  const setSidecarOff = useCallback(() => {
    setCues([]);
    setSidecarUrl(null);
    setStatus('disabled');
    if (key) setSubtitleChoice(key, { off: true, url: undefined });
  }, [key]);

  const setOffset = useCallback(
    (next: number) => {
      const clamped = Math.max(-30_000, Math.min(30_000, Math.round(next / 250) * 250));
      setOffsetState(clamped);
      if (key) setSubtitleChoice(key, { offsetMs: clamped });
    },
    [key],
  );

  return {
    tracks,
    activeTrack,
    // Cues are returned unshifted: the overlay applies `offsetMs` in its lookup, so applying it here
    // as well would double the correction.
    cues,
    sidecarUrl,
    status: enabled ? status : 'disabled',
    offsetMs,
    selectTrack,
    setSidecarOff,
    loadFromUrl,
    probe,
    setOffset,
  };
}
