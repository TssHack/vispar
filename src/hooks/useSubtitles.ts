import { useEventListener } from 'expo';
import type { VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type { Source } from '@/api/types';
import { getSubtitleChoice, setSubtitleChoice, useSubtitleChoice } from '@/lib/subtitles/store';
import { loadSubtitle, probeSidecar } from '@/lib/subtitles/load';
import { type Cue } from '@/lib/subtitles/parse';
import { planSidecar } from '@/lib/subtitles/plan';
import { pickTrack, trackLabel, type TrackInfo } from '@/lib/subtitles/tracks';
import { useSetting } from '@/settings/store';

/**
 * One place that decides which subtitles are showing and how.
 *
 * The player stays responsible for video, this hook for text. Two sources feed it, and only one is
 * ever visible at a time:
 * - **Embedded tracks** (Android/iOS only): `expo-video` reports them once the file has loaded,
 *   through `availableSubtitleTracksChange` / `sourceLoad`, and draws the selected one natively.
 * - **Sidecar files** (every platform, including web): fetched, parsed and drawn by our overlay.
 *
 * The native player is the source of truth for the embedded track: it may pick the container's
 * default track by itself, so `subtitleTrackChange` is mirrored into state, and "off" is enforced on
 * the player rather than only remembered.
 */

/** `expo-video` reports tracks only on native; the web build stubs the API out. */
const NATIVE_TRACKS = Platform.OS === 'android' || Platform.OS === 'ios';

/** If the player never reports its tracks (a broken file, an old OS), stop waiting and allow a sidecar. */
const TRACKS_TIMEOUT_MS = 8000;

export type SubtitleState = {
  /** Embedded tracks the container reports. Empty on web. `label` is ready for the menu. */
  tracks: { id: string; label: string; language: string }[];
  /** Id of the embedded track the player is showing, or null. */
  activeTrack: string | null;
  /** Sidecar cues currently loaded, if any. */
  cues: Cue[];
  /** Where the loaded sidecar came from, for the menu label. */
  sidecarUrl: string | null;
  /** Human-readable status for the menu: loading, not found, or the reason we show nothing. */
  status: 'idle' | 'loading' | 'ready' | 'missing' | 'disabled';
  offsetMs: number;
  /** User choice from the menu. Persisted for this title. */
  selectTrack: (track: { id: string; language: string } | null) => void;
  /** Turns off both the embedded track and any loaded sidecar, and remembers it for this title. */
  setSidecarOff: () => void;
  /** Load a specific URL the user supplied, and remember it for this title. */
  loadFromUrl: (url: string) => Promise<boolean>;
  /** Try the conventional sidecar names next to the video. */
  probe: () => void;
  setOffset: (offsetMs: number) => void;
  /** Undo "off for this title" and pick a track or look for a sidecar again. */
  turnOn: () => void;
};

type RawTrack = { id?: string; label: string; language: string; name?: string; isDefault?: boolean };

const toInfo = (list: RawTrack[] | undefined): TrackInfo[] =>
  (list ?? []).map((t, index) => ({ id: t.id ?? String(index), language: t.language ?? '', label: t.label ?? '', name: t.name, isDefault: t.isDefault }));

const fingerprintOf = (list: TrackInfo[]) => list.map((t) => `${t.id}:${t.language}:${t.name ?? ''}`).join('|');

export function useSubtitles(options: {
  /** Stable key for this title or episode; null disables persistence. */
  key: string | null;
  /** The source being played, used to find a sidecar. */
  source: Source | null;
  /** The resolved title, kept for diagnostics. */
  title: string;
  player: VideoPlayer;
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
  const [activeTrack, setActiveTrack] = useState<string | null>(null);
  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  /** Whether the current source's embedded tracks have been reported. Always true on web. */
  const [tracksKnown, setTracksKnown] = useState(!NATIVE_TRACKS);

  // Bumped on every new request and on every title change, so a slow response for a superseded
  // request is dropped instead of overwriting the current state.
  const request = useRef(0);
  const probedFor = useRef<string | null>(null);
  const autoSelected = useRef<string | null>(null);
  const prevTracks = useRef('');

  // The hook survives quality switches AND episode changes (the next-episode button replaces the
  // route with the same screen), so everything that belongs to one title is reset when the key
  // changes. Otherwise the previous episode's cues keep showing when the new one has none.
  useEffect(() => {
    request.current++;
    probedFor.current = null;
    autoSelected.current = null;
    setCues([]);
    setSidecarUrl(null);
    setStatus('idle');
    setActiveTrack(null);
    setOffsetState(getSubtitleChoice(key ?? '').offsetMs ?? 0);
  }, [key]);

  // A new source (quality switch, next episode) has its own tracks: forget the old list and wait for
  // the player to report the new one, with a timeout so a silent player cannot block sidecars forever.
  useEffect(() => {
    if (!NATIVE_TRACKS) return;
    prevTracks.current = '';
    setTracks([]);
    setTracksKnown(false);
    setActiveTrack(null);
    if (!source?.url) return;
    const timer = setTimeout(() => setTracksKnown(true), TRACKS_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [source?.url]);

  const applyTracks = useCallback((raw: RawTrack[] | undefined) => {
    if (!NATIVE_TRACKS) return;
    const list = toInfo(raw);
    const fingerprint = fingerprintOf(list);
    if (fingerprint !== prevTracks.current) {
      prevTracks.current = fingerprint;
      setTracks(list);
    }
    setTracksKnown(true);
  }, []);

  // The track list is not a React value: it arrives with the loaded source and can change later
  // (HLS renditions). Before this listener existed the list was read once, before the file loaded,
  // and stayed empty, so embedded subtitles never reached the menu.
  useEventListener(player, 'sourceLoad', (e) => applyTracks(e.availableSubtitleTracks as RawTrack[]));
  useEventListener(player, 'availableSubtitleTracksChange', (e) => applyTracks(e.availableSubtitleTracks as RawTrack[]));
  useEventListener(player, 'statusChange', (e) => {
    if (e.status === 'readyToPlay') applyTracks(player.availableSubtitleTracks as RawTrack[]);
    else if (e.status === 'error') setTracksKnown(true);
  });
  // The player can select a track on its own (the container's default flag): mirror what it shows.
  useEventListener(player, 'subtitleTrackChange', (e) => {
    if (!NATIVE_TRACKS) return;
    const live = (player.availableSubtitleTracks ?? []) as RawTrack[];
    const now = e.subtitleTrack as RawTrack | null;
    if (!now) return setActiveTrack(null);
    const index = live.findIndex((t) => t === now || (t.id !== undefined && t.id === now.id));
    setActiveTrack(now.id ?? (index >= 0 ? String(index) : null));
  });

  /**
   * Shows an embedded track (or none) on the player. The object assigned must come from the live
   * `availableSubtitleTracks` array: anything else crashes natively, so it is looked up by id there.
   */
  const showTrack = useCallback(
    (id: string | null) => {
      if (!NATIVE_TRACKS) return;
      const live = (player.availableSubtitleTracks ?? []) as RawTrack[];
      const match = id === null ? null : (live.find((t, i) => (t.id ?? String(i)) === id) ?? null);
      try {
        player.subtitleTrack = (match ?? null) as VideoPlayer['subtitleTrack'];
      } catch {
        // A released player throws; there is nothing to show then anyway.
      }
      setActiveTrack(match ? id : null);
    },
    [player],
  );

  /** Drops any loaded sidecar, so two subtitles never show at once. */
  const clearSidecar = useCallback(() => {
    request.current++;
    setCues([]);
    setSidecarUrl(null);
  }, []);

  const selectTrack = useCallback(
    (track: { id: string; language: string } | null) => {
      if (!NATIVE_TRACKS) return;
      if (track) clearSidecar();
      showTrack(track ? track.id : null);
      if (key) setSubtitleChoice(key, track ? { language: track.language, off: false, url: undefined } : { off: true });
    },
    [showTrack, clearSidecar, key],
  );

  // Once per source, after the tracks are known: pick a track, or make sure none shows. "None" has to
  // be applied to the player, because it may already be showing the container's default track even
  // though the user turned subtitles off (globally, or for this title).
  useEffect(() => {
    if (!NATIVE_TRACKS || !tracksKnown || !source?.url) return;
    if (autoSelected.current === source.url) return;
    if (!enabled || saved.off || saved.url) {
      autoSelected.current = source.url;
      showTrack(null);
      return;
    }
    // No tracks yet (the wait timed out on a slow file): stay unmarked, so they are picked on arrival.
    if (!tracks.length) return;
    autoSelected.current = source.url;
    // A sidecar found while waiting is already on screen; keep it rather than swapping mid-sentence.
    if (cues.length) {
      showTrack(null);
      return;
    }
    const pick = pickTrack(tracks, preferredLanguage, saved.language);
    if (pick) showTrack(pick.id);
  }, [tracksKnown, tracks, cues.length, source?.url, enabled, saved.off, saved.url, saved.language, preferredLanguage, showTrack]);

  // Turning subtitles off in settings while playing hides an embedded track at once.
  useEffect(() => {
    if (NATIVE_TRACKS && !enabled) showTrack(null);
  }, [enabled, showTrack]);

  /** A sidecar just loaded: it replaces whatever embedded track was showing. */
  const showCues = useCallback(
    (next: Cue[], url: string) => {
      if (NATIVE_TRACKS && player.subtitleTrack) showTrack(null);
      setCues(next);
      setSidecarUrl(url);
      setStatus('ready');
    },
    [player, showTrack],
  );

  const loadFromUrl = useCallback(
    async (url: string) => {
      const mine = ++request.current;
      setStatus('loading');
      const result = await loadSubtitle(url);
      if (mine !== request.current) return false; // superseded by a newer request or a title change
      if (!result.ok) {
        setStatus('missing');
        return false;
      }
      showCues(result.cues, result.url);
      if (key) setSubtitleChoice(key, { url: result.url, off: false });
      return true;
    },
    [key, showCues],
  );

  /**
   * Sidecar discovery. Skipped when the file is known to have burned-in subtitles (overlaying text
   * would double it), when an embedded track covers the case, and until the tracks are known.
   */
  const probe = useCallback(() => {
    const action = planSidecar({ source, enabled, autoProbe, hasEmbeddedTracks: NATIVE_TRACKS && tracks.length > 0, tracksKnown, saved, probedFor: probedFor.current });
    if (action === 'disabled') {
      setStatus('disabled');
    } else if (action === 'load-saved' && saved.url) {
      void loadFromUrl(saved.url);
    } else if (action === 'probe' && source?.url) {
      probedFor.current = source.url;
      const mine = ++request.current;
      setStatus('loading');
      void probeSidecar(source.url).then((result) => {
        if (mine !== request.current) return;
        if (result.ok) showCues(result.cues, result.url);
        else setStatus('missing');
      });
    } else if (action === 'none' && tracks.length) {
      setStatus('ready');
    }
  }, [source, enabled, autoProbe, tracks.length, tracksKnown, saved, loadFromUrl, showCues]);

  // Keyed on the inputs, not on `probe`: depending on the callback would re-run whenever it is
  // recreated, which is not a reason for another network request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => probe(), [source?.url, enabled, autoProbe, saved.url, saved.off, tracks.length, tracksKnown]);

  const setSidecarOff = useCallback(() => {
    clearSidecar();
    showTrack(null);
    setStatus('disabled');
    if (key) setSubtitleChoice(key, { off: true, url: undefined });
  }, [key, clearSidecar, showTrack]);

  const turnOn = useCallback(() => {
    probedFor.current = null;
    autoSelected.current = null; // pick a track again for this source
    if (key) setSubtitleChoice(key, { off: false });
    setStatus('idle');
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
    tracks: tracks.map((t) => ({ id: t.id, language: t.language, label: trackLabel(t) })),
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
    turnOn,
  };
}
