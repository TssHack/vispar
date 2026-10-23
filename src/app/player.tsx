import { useEvent, useEventListener } from 'expo';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ContentType, Source } from '@/api/types';
import { Button } from '@/components/Button';
import { goBack } from '@/components/DetailHeader';
import { Focusable } from '@/components/Focusable';
import { Icon, type IconName } from '@/components/Icon';
import { NotFound } from '@/components/NotFound';
import { Text } from '@/components/Text';
import { toast } from '@/components/Toast';
import { download, playInternal } from '@/external/actions';
import { copyLink } from '@/external/launch';
import * as Clipboard from 'expo-clipboard';
import { explainPlaybackError, isBlockedByBrowser, playableUrl, upgradeToHttps } from '@/lib/media';
import { openExternalSheet } from '@/external/sheet';
import { useLayout } from '@/hooks/useLayout';
import { useRemote } from '@/hooks/useRemote';
import { canResume, getProgress, progressKey, saveProgress, snapshot } from '@/library/store';
import { faClock, faNum, isStreamOnly, qualityLabel } from '@/lib/format';
import { canPlayInApp, containerLabel, containerOf, isTrailer } from '@/lib/containers';
import { appPlatform } from '@/lib/platform';
import { pickSource, sortSources } from '@/lib/sources';
import { SeekBar } from '@/player/SeekBar';
import { usePlayContext } from '@/player/usePlayContext';
import { SubtitleOverlay } from '@/components/SubtitleOverlay';
import { useSubtitles } from '@/hooks/useSubtitles';
import { subtitleHint } from '@/lib/subtitles/parse';
import { subtitleKey } from '@/lib/subtitles/store';
import { getSettings, useSetting } from '@/settings/store';
import { useTheme } from '@/theme/ThemeProvider';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const FIT_NEXT = { contain: 'cover', cover: 'fill', fill: 'contain' } as const;
const FIT_LABEL = { contain: 'اصلی', cover: 'پر کردن', fill: 'کشیده' } as const;
type Menu = null | 'quality' | 'speed' | 'more' | 'subtitles';

function CtrlButton({ icon, label, onPress, size = 48, iconSize = 24, filled }: { icon: IconName; label: string; onPress: () => void; size?: number; iconSize?: number; filled?: boolean }) {
  return (
    <Focusable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      ringRadius={size / 2}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: filled ? 'rgba(255,255,255,0.16)' : 'transparent' }}
    >
      <Icon name={icon} size={iconSize} color="#F4F1EA" />
    </Focusable>
  );
}

function PillButton({ icon, text, label, onPress }: { icon: IconName; text: string; label: string; onPress: () => void }) {
  return (
    <Focusable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} ringRadius={12} style={{ height: 40, paddingHorizontal: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name={icon} size={20} color="#F4F1EA" />
      <Text size={13} weight={700} color="#F4F1EA">
        {text}
      </Text>
    </Focusable>
  );
}

function MenuRow({ label, sub, selected, onPress }: { label: string; sub?: string; selected?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Focusable
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityState={{ selected: !!selected }}
      ringRadius={12}
      style={{ minHeight: 48, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: selected ? 'rgba(255,255,255,0.1)' : 'transparent' }}
    >
      <View style={{ flex: 1 }}>
        <Text size={14} weight={selected ? 800 : 600} color="#F4F1EA">
          {label}
        </Text>
        {sub ? (
          <Text size={12} color="#A7A3B3">
            {sub}
          </Text>
        ) : null}
      </View>
      {selected ? <Icon name="check" size={18} color={colors.accent} /> : null}
    </Focusable>
  );
}

export default function PlayerScreen() {
  // Keep the screen on while playing. On web the wake lock may not be active yet when we leave
  // (and some browsers refuse it), so both calls swallow their errors instead of surfacing them.
  useEffect(() => {
    const tag = 'vispar-player';
    activateKeepAwakeAsync(tag).catch(() => {});
    return () => {
      Promise.resolve()
        .then(() => deactivateKeepAwake(tag))
        .catch(() => {});
    };
  }, []);
  const params = useLocalSearchParams<{ url?: string; q?: string; title?: string; type?: string; id?: string; s?: string; e?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isTV, isWeb, isWide, width } = useLayout();
  const skip = useSetting('skipSeconds');
  const autoplayNext = useSetting('autoplayNext');
  const [fit, setFit] = useState(getSettings().videoFit);

  const type = params.type === 'movie' || params.type === 'serie' ? (params.type as ContentType) : undefined;
  const id = Number(params.id ?? 0);
  const sIdx = params.s !== undefined ? Number(params.s) : undefined;
  const eIdx = params.e !== undefined ? Number(params.e) : undefined;
  const ctx = usePlayContext(type, id, sIdx, eIdx);

  const fallbackSource = useMemo<Source | null>(() => (params.url ? { id: 0, quality: params.q ?? '', type: '', url: params.url } : null), [params.url, params.q]);
  const sources = useMemo(() => (ctx.sources.length ? sortSources(ctx.sources) : fallbackSource ? [fallbackSource] : []), [ctx.sources, fallbackSource]);
  const [current, setCurrent] = useState<Source | null>(fallbackSource);
  useEffect(() => {
    // Opened without a URL (e.g. from "continue watching"): use the default quality once known.
    if (!current && ctx.sources.length) setCurrent(pickSource(ctx.sources, getSettings().defaultQuality, { platform: appPlatform() }));
  }, [ctx.sources]); // eslint-disable-line react-hooks/exhaustive-deps

  const title = ctx.poster?.title ?? params.title ?? '';
  const key = type ? progressKey(type, id, ctx.episode?.episodeId) : null;

  const player = useVideoPlayer(fallbackSource && !isBlockedByBrowser(fallbackSource.url) && canPlayInApp(fallbackSource, appPlatform()) ? { uri: playableUrl(fallbackSource.url), metadata: { title } } : null, (p) => {
    p.timeUpdateEventInterval = 0.5;
    p.play();
  });

  // Load `current` into the player whenever it changes (first resolve, or a quality switch).
  const loadedUrl = useRef<string | null>(fallbackSource && !isBlockedByBrowser(fallbackSource.url) && canPlayInApp(fallbackSource, appPlatform()) ? fallbackSource.url : null);
  // HTTPS page + http file: first see whether the host also serves the file over https.
  const [httpsOf, setHttpsOf] = useState<Record<string, string | false>>({});
  const pendingSeek = useRef<number | null>(null);
  useEffect(() => {
    if (!current || loadedUrl.current === current.url) return;
    if (!canPlayInApp(current, appPlatform())) return; // explained by the panel below, never handed to the decoder
    const upgraded = httpsOf[current.url];
    if (isBlockedByBrowser(current.url) && !upgraded) return;
    loadedUrl.current = current.url;
    player
      .replaceAsync({ uri: playableUrl(upgraded || current.url), metadata: { title, artist: ctx.subtitle || undefined } })
      .then(() => {
        if (pendingSeek.current !== null) {
          player.currentTime = pendingSeek.current;
          pendingSeek.current = null;
        }
        player.play();
      })
      .catch(() => toast('بارگذاری ویدیو ممکن نشد', 'alert'));
  }, [current, player, title, ctx.subtitle, httpsOf]);
  useEffect(() => {
    if (!current || !isBlockedByBrowser(current.url) || current.url in httpsOf) return;
    const url = current.url;
    upgradeToHttps(url).then((u) => setHttpsOf((m) => ({ ...m, [url]: u ?? false })));
  }, [current, httpsOf]);

  const { status, error } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { currentTime } = useEvent(player, 'timeUpdate', { currentTime: player.currentTime, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  const { playbackRate } = useEvent(player, 'playbackRateChange', { playbackRate: player.playbackRate, oldPlaybackRate: 1 });
  const { muted } = useEvent(player, 'mutedChange', { muted: player.muted });
  const duration = player.duration || 0;

  // ---------- subtitles ----------
  const subtitleStyle = useSetting('subtitleSize');
  const subtitleBackground = useSetting('subtitleBackground');
  const subs = useSubtitles({
    key: type ? subtitleKey(type, id, ctx.episode?.episodeId) : null,
    source: current,
    title,
    player,
  });
  /** Short label for the control bar: what the subtitle button currently shows. */
  const subtitleLabel = !subs.cues.length && !subs.activeTrack ? 'خاموش' : subs.sidecarUrl && /\.(fa|persian|per)\.(srt|vtt)/i.test(subs.sidecarUrl) ? 'فارسی' : 'روشن';

  // ---------- controls visibility ----------
  const [visible, setVisible] = useState(true);
  const [menu, setMenu] = useState<Menu>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poke = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), isTV ? 5500 : 3500);
  }, [isTV]);
  useEffect(() => {
    if (!isPlaying || menu || scrubbing) {
      setVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    } else poke();
  }, [isPlaying, menu, scrubbing, poke]);

  // ---------- actions ----------
  const toggle = useCallback(() => (player.playing ? player.pause() : player.play()), [player]);
  const seekTo = useCallback(
    (t: number) => {
      player.currentTime = Math.max(0, duration ? Math.min(t, duration - 1) : t);
    },
    [player, duration],
  );
  const seekBy = useCallback(
    (d: number) => {
      player.seekBy(d);
      poke();
    },
    [player, poke],
  );
  const switchSource = (s: Source) => {
    pendingSeek.current = player.currentTime;
    setMenu(null);
    setCurrent(s);
  };

  // ---------- resume ----------
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const resumeChecked = useRef(false);
  useEffect(() => {
    if (status !== 'readyToPlay' || resumeChecked.current || !key) return;
    resumeChecked.current = true;
    const saved = getProgress(key);
    if (!canResume(saved)) return;
    if (getSettings().autoResume) {
      seekTo(saved!.position);
      toast(`ادامه از ${faClock(saved!.position)}`, 'history');
    } else {
      setResumeAt(saved!.position);
      setTimeout(() => setResumeAt(null), 9000);
    }
  }, [status, key, seekTo]);

  // ---------- progress saving ----------
  const lastSaved = useRef(0);
  const save = useCallback(() => {
    if (!ctx.poster || !player.duration) return;
    saveProgress({
      poster: snapshot(ctx.poster),
      episode: ctx.episode
        ? { seasonIndex: ctx.episode.seasonIndex, episodeIndex: ctx.episode.episodeIndex, episodeId: ctx.episode.episodeId, title: ctx.episode.title }
        : undefined,
      position: player.currentTime,
      duration: player.duration,
    });
  }, [ctx.poster, ctx.episode, player]);
  useEffect(() => {
    if (Math.abs(currentTime - lastSaved.current) >= 5) {
      lastSaved.current = currentTime;
      save();
    }
  }, [currentTime, save]);
  useEffect(() => {
    if (!isPlaying) save();
  }, [isPlaying, save]);
  useEffect(() => () => save(), [save]);

  // ---------- end of video / next episode ----------
  const [ended, setEnded] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const goNext = useCallback(() => {
    if (!ctx.next) return;
    const src = pickSource(ctx.next.sources, getSettings().defaultQuality, { platform: appPlatform() });
    if (!src) {
      toast('برای قسمت بعد لینکی ثبت نشده', 'alert');
      return;
    }
    playInternal(src, ctx.next.ctx, true);
  }, [ctx.next]);
  useEventListener(player, 'playToEnd', () => {
    save();
    setEnded(true);
    if (ctx.next && autoplayNext) setCountdown(5);
  });
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      goNext();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, goNext]);

  // ---------- fullscreen & orientation ----------
  const phone = Platform.OS !== 'web' && !isTV && Math.min(width, 900) < 700;
  const [full, setFull] = useState(phone);
  useEffect(() => {
    if (Platform.OS === 'web' || isTV) return;
    (full ? ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE) : ScreenOrientation.unlockAsync()).catch(() => {});
  }, [full, isTV]);
  useEffect(
    () => () => {
      if (Platform.OS !== 'web') ScreenOrientation.unlockAsync().catch(() => {});
    },
    [],
  );
  const toggleFull = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen().catch(() => {});
      return;
    }
    setFull((f) => !f);
  };

  // ---------- keyboard (web) ----------
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = ev.key.toLowerCase();
      if (k === ' ' || k === 'k') toggle();
      else if (k === 'arrowright' || k === 'l') seekBy(skip);
      else if (k === 'arrowleft' || k === 'j') seekBy(-skip);
      else if (k === 'arrowup') player.volume = Math.min(1, player.volume + 0.1);
      else if (k === 'arrowdown') player.volume = Math.max(0, player.volume - 0.1);
      else if (k === 'm') player.muted = !player.muted;
      else if (k === 'f') toggleFull();
      else if (k === 'n' && ctx.next) goNext();
      else if (k === 'escape' && !document.fullscreenElement) goBack();
      else return;
      ev.preventDefault();
      poke();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // re-bind each render so handlers see current state

  // ---------- remote control (Android TV) ----------
  // With the controls hidden the D-pad drives playback directly; with them shown it moves focus
  // and every key press just keeps them on screen.
  useRemote((k) => {
    if (!isTV) return;
    if (k === 'playPause') toggle();
    else if (k === 'play') player.play();
    else if (k === 'pause') player.pause();
    else if (k === 'rewind') seekBy(-skip * 2);
    else if (k === 'fastForward') seekBy(skip * 2);
    else if (!visible && !menu && !ended) {
      if (k === 'left') seekBy(-skip);
      else if (k === 'right') seekBy(skip);
      else if (k === 'select') toggle();
      else if (k === 'up' || k === 'down' || k === 'menu') {
        /* fall through to show controls */
      } else return;
    }
    poke();
  });
  useEffect(() => {
    if (!isTV) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (menu) {
        setMenu(null);
        return true;
      }
      if (visible && isPlaying && !ended) {
        setVisible(false);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [isTV, menu, visible, isPlaying, ended]);

  // ---------- double-tap to seek (touch) ----------
  const lastTap = useRef<{ t: number; side: 'l' | 'r' } | null>(null);
  const [flash, setFlash] = useState<'l' | 'r' | null>(null);
  const onSurfacePress = (side: 'l' | 'r') => {
    const now = Date.now();
    if (lastTap.current && now - lastTap.current.t < 280 && lastTap.current.side === side) {
      lastTap.current = null;
      seekBy(side === 'r' ? skip : -skip);
      setFlash(side);
      setTimeout(() => setFlash(null), 450);
      return;
    }
    lastTap.current = { t: now, side };
    setTimeout(() => {
      if (lastTap.current && lastTap.current.t === now) {
        lastTap.current = null;
        if (menu) setMenu(null);
        else if (visible && isPlaying) setVisible(false);
        else poke();
      }
    }, 290);
  };

  const resolving = !current && type === 'serie' && sIdx !== undefined && !ctx.episode;
  if (!current && !sources.length && !resolving) return <NotFound title="لینک پخش نامعتبر است" body="دوباره از صفحه‌ی فیلم امتحان کنید." />;

  const blocked = !!current && isBlockedByBrowser(current.url) && !httpsOf[current.url];
  const unplayable = !!current && !canPlayInApp(current, appPlatform());
  const checkingHttps = !!current && isBlockedByBrowser(current.url) && !(current.url in httpsOf);
  const big = isTV || isWide;
  const side = Math.max(insets.left, insets.right, 16);
  const top = Math.max(insets.top, 12);
  const bottom = Math.max(insets.bottom, 12);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar hidden={full} style="light" />
      <VideoView player={player} style={{ flex: 1 }} contentFit={fit} nativeControls={false} allowsPictureInPicture startsPictureInPictureAutomatically />

      {/* Subtitles sit above the video and below the controls, and never take a tap. */}
      {subs.cues.length ? (
        <SubtitleOverlay
          cues={subs.cues}
          time={currentTime}
          offsetMs={subs.offsetMs}
          style={{ size: subtitleStyle, background: subtitleBackground }}
          bottomInset={bottom + 96}
          scale={isTV ? 1.35 : 1}
        />
      ) : null}

      {/* Tap surface: halves for double-tap seek */}
      <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row', direction: 'ltr' }}>
        <Pressable accessible={false} focusable={false} style={{ flex: 1 }} onPress={() => onSurfacePress('l')} />
        <Pressable accessible={false} focusable={false} style={{ flex: 1 }} onPress={() => onSurfacePress('r')} />
      </View>

      {flash ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, [flash === 'r' ? 'right' : 'left']: 0, width: '35%', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' }}>
          <Icon name={flash === 'r' ? 'forward' : 'rewind'} size={34} color="#F4F1EA" />
          <Text size={13} weight={700} color="#F4F1EA">
            {faNum(skip)} ثانیه
          </Text>
        </View>
      ) : null}

      {(status === 'loading' && !blocked && !unplayable) || resolving || checkingHttps ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : null}

      {/* Overlay controls */}
      {visible && status !== 'error' && !ended && !blocked && !unplayable ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'space-between' }}>
          <LinearGradient pointerEvents="box-none" colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0)']} style={{ paddingTop: top, paddingHorizontal: side, paddingBottom: 36, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {!isTV ? <CtrlButton icon="back" label="بستن پخش" onPress={goBack} size={44} iconSize={22} filled /> : null}
            <View style={{ flex: 1 }}>
              <Text size={big ? 18 : 15} weight={800} color="#F4F1EA" numberOfLines={1}>
                {title}
              </Text>
              {ctx.subtitle ? (
                <Text size={12} color="#C9C5D3" numberOfLines={1}>
                  {ctx.subtitle}
                </Text>
              ) : null}
            </View>
            <CtrlButton icon="more" label="گزینه‌های بیشتر" onPress={() => setMenu(menu === 'more' ? null : 'more')} size={44} iconSize={22} filled />
          </LinearGradient>

          {/* Centre transport (media controls stay left-to-right) */}
          <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: big ? 40 : 28, direction: 'ltr' }}>
            <CtrlButton icon="rewind" label={`${faNum(skip)} ثانیه عقب`} onPress={() => seekBy(-skip)} size={big ? 64 : 56} iconSize={big ? 32 : 28} />
            <Focusable
              onPress={() => {
                toggle();
                poke();
              }}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'توقف' : 'پخش'}
              hasTVPreferredFocus={isTV}
              ringRadius={42}
              style={{ width: big ? 84 : 72, height: big ? 84 : 72, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}
            >
              <Icon name={isPlaying ? 'pause' : 'play'} size={big ? 36 : 30} color={colors.onAccent} />
            </Focusable>
            <CtrlButton icon="forward" label={`${faNum(skip)} ثانیه جلو`} onPress={() => seekBy(skip)} size={big ? 64 : 56} iconSize={big ? 32 : 28} />
          </View>

          <LinearGradient pointerEvents="box-none" colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']} style={{ paddingTop: 40, paddingBottom: bottom, paddingHorizontal: side, gap: 6 }}>
            <SeekBar position={currentTime} duration={duration} buffered={player.bufferedPosition} accent={colors.accent} onSeek={seekTo} onScrubbing={setScrubbing} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, direction: 'ltr' }}>
              <CtrlButton icon={muted ? 'mute' : 'volume'} label={muted ? 'صدا روشن' : 'بی‌صدا'} onPress={() => (player.muted = !player.muted)} size={44} iconSize={22} />
              {ctx.next ? <CtrlButton icon="next" label="قسمت بعد" onPress={goNext} size={44} iconSize={22} /> : null}
              <View style={{ flex: 1 }} />
              <PillButton icon="gauge" text={faNum(`${playbackRate}x`)} label="سرعت پخش" onPress={() => setMenu(menu === 'speed' ? null : 'speed')} />
              {current ? <PillButton icon="layers" text={current.quality || 'کیفیت'} label="کیفیت" onPress={() => setMenu(menu === 'quality' ? null : 'quality')} /> : null}
              <PillButton
                icon="subtitles"
                text={subtitleLabel}
                label="زیرنویس"
                onPress={() => setMenu(menu === 'subtitles' ? null : 'subtitles')}
              />
              {!isTV ? <CtrlButton icon={full ? 'fullscreenExit' : 'fullscreen'} label={full ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'} onPress={toggleFull} size={44} iconSize={22} /> : null}
            </View>
          </LinearGradient>
        </View>
      ) : null}

      {/* Menus */}
      {menu ? (
        <View
          style={{
            position: 'absolute',
            bottom: bottom + 110,
            [isWeb || isWide ? 'right' : 'left']: side,
            width: Math.min(320, width - 32),
            maxHeight: 360,
            borderRadius: 18,
            backgroundColor: 'rgba(17,17,24,0.97)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            padding: 8,
          }}
        >
          <ScrollView>
            {menu === 'speed'
              ? SPEEDS.map((r) => (
                  <MenuRow
                    key={r}
                    label={r === 1 ? 'عادی' : faNum(`${r}x`)}
                    selected={Math.abs(playbackRate - r) < 0.01}
                    onPress={() => {
                      player.playbackRate = r;
                      setMenu(null);
                    }}
                  />
                ))
              : menu === 'subtitles'
                ? [
                    <MenuRow
                      key="off"
                      label="خاموش"
                      selected={!subs.cues.length && !subs.activeTrack}
                      onPress={() => {
                        subs.selectTrack(null);
                        subs.setSidecarOff();
                        setMenu(null);
                      }}
                    />,
                    ...subs.tracks.map((t) => (
                      <MenuRow
                        key={`track-${t.id}`}
                        label={t.label || t.language}
                        sub={current && subtitleHint(current) === 'hard' ? 'زیرنویس داخل تصویر' : 'زیرنویس داخلی فایل'}
                        selected={subs.activeTrack === t.id}
                        onPress={() => {
                          subs.selectTrack({ id: t.id, language: t.language });
                          setMenu(null);
                        }}
                      />
                    )),
                    subs.status === 'disabled' && current && subtitleHint(current) !== 'hard' ? (
                      <MenuRow key="turn-on" label="روشن کردن زیرنویس" sub="دوباره دنبال فایل زیرنویس می‌گردد" onPress={() => { subs.turnOn(); setMenu(null); }} />
                    ) : null,
                    subs.tracks.length || subs.cues.length || subs.status === 'disabled' ? null : (
                      <MenuRow key="none" label="زیرنویسی پیدا نشد" sub="از تنظیمات یا لینک می‌توانی اضافه کنی" onPress={() => setMenu(null)} />
                    ),
                    <MenuRow
                      key="offset-down"
                      label="زیرنویس زودتر · ۰٫۵ ثانیه"
                      sub={`فاصله‌ی فعلی: ${faNum((subs.offsetMs / 1000).toFixed(1))} ثانیه`}
                      onPress={() => subs.setOffset(subs.offsetMs - 500)}
                    />,
                    <MenuRow key="offset-up" label="زیرنویس دیرتر · ۰٫۵ ثانیه" onPress={() => subs.setOffset(subs.offsetMs + 500)} />,
                    <MenuRow
                      key="style"
                      label="اندازه و پس‌زمینه"
                      sub="از تنظیمات قابل تغییر است"
                      onPress={() => {
                        setMenu(null);
                        router.push('/settings');
                      }}
                    />,
                  ].filter(Boolean)
                : menu === 'quality'
                ? sources.map((s) => (
                    <MenuRow
                      key={s.url}
                      label={s.quality || qualityLabel(s.quality)}
                      sub={[qualityLabel(s.quality), s.type.toUpperCase(), isStreamOnly(s) ? 'پخش آنلاین' : null].filter(Boolean).join(' · ')}
                      selected={current?.url === s.url}
                      onPress={() => (current?.url === s.url ? setMenu(null) : switchSource(s))}
                    />
                  ))
                : (
                    <>
                      <MenuRow
                        label={`نمای تصویر: ${FIT_LABEL[fit]}`}
                        sub="جا شدن، پر کردن صفحه یا کشیدن"
                        onPress={() => setFit(FIT_NEXT[fit])}
                      />
                      <MenuRow
                        label="پخش با پلیر دیگر"
                        sub="VLC، MX Player و…"
                        onPress={() => {
                          setMenu(null);
                          player.pause();
                          if (current) openExternalSheet({ kind: 'player', url: current.url, title });
                        }}
                      />
                      {current && !isStreamOnly(current) && !isTV ? (
                        <MenuRow
                          label="دانلود این کیفیت"
                          sub="با دانلودر دلخواه"
                          onPress={() => {
                            setMenu(null);
                            download(current, title, { forceChooser: true });
                          }}
                        />
                      ) : null}
                      {current ? (
                        <MenuRow
                          label="کپی لینک"
                          onPress={() => {
                            setMenu(null);
                            copyLink(current.url);
                          }}
                        />
                      ) : null}
                    </>
                  )}
          </ScrollView>
        </View>
      ) : null}

      {/* Resume prompt */}
      {resumeAt !== null ? (
        <View
          style={{
            position: 'absolute',
            top: top + 64,
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 10,
            paddingHorizontal: 14,
            borderRadius: 18,
            backgroundColor: 'rgba(17,17,24,0.95)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <Icon name="history" size={20} color={colors.accent} />
          <Text size={13} weight={600} color="#F4F1EA">
            از {faClock(resumeAt)} ادامه بدهم؟
          </Text>
          <Button
            label="ادامه"
            onPress={() => {
              seekTo(resumeAt);
              setResumeAt(null);
            }}
            hasTVPreferredFocus={isTV}
          />
          <Button label="از اول" variant="onImage" onPress={() => setResumeAt(null)} />
        </View>
      ) : null}

      {/* A container this platform's decoder cannot play (MKV on iOS): say so, never show a generic error */}
      {unplayable && current ? (
        <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, backgroundColor: '#000' }}>
          <Icon name="alert" size={36} color="#F4F1EA" />
          <Text size={17} weight={800} color="#F4F1EA" align="center">
            این فایل {containerLabel(containerOf(current)) || ''} است و iOS آن را پخش نمی‌کند
          </Text>
          <Text size={13} color="#C9C5D3" align="center" style={{ maxWidth: 520 }}>
            پلیر داخلی آیفون و آیپد (AVPlayer) فایل‌های MKV را نمی‌شناسد. همین فایل را با VLC، Infuse یا nPlayer باز کنید، یا اگر کیفیت دیگری از نوع MP4 هست آن را امتحان کنید.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
            <Button label="پخش با پلیر دیگر" icon="external" onPress={() => openExternalSheet({ kind: 'player', url: current.url, title })} hasTVPreferredFocus={isTV} />
            {sources
              .filter((s) => s.url !== current.url && !isTrailer(s) && canPlayInApp(s, appPlatform()))
              .slice(0, 1)
              .map((s) => (
                <Button key={s.url} label={`امتحان با ${s.quality}`} variant="onImage" onPress={() => switchSource(s)} />
              ))}
            <Button label="کپی لینک" icon="link" variant="onImage" onPress={() => copyLink(current.url)} />
            <Button label="بازگشت" variant="onImage" onPress={goBack} />
          </View>
        </View>
      ) : null}

      {/* HTTPS page + plain-HTTP media: the browser refuses to load it, so explain and offer the way out */}
      {blocked && !checkingHttps && current ? (
        <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, backgroundColor: '#000' }}>
          <Icon name="alert" size={36} color="#F4F1EA" />
          <Text size={17} weight={800} color="#F4F1EA" align="center">
            مرورگر اجازه‌ی پخش این فایل را نمی‌دهد
          </Text>
          <Text size={13} color="#C9C5D3" align="center" style={{ maxWidth: 520 }}>
            فایل‌ها روی سرور بدون HTTPS هستند و مرورگر آن‌ها را در صفحه‌ی امن مسدود می‌کند. با پلیر دیگر مثل VLC پخش کنید، یا برنامه‌ی اندروید و دسکتاپ ویسپار را نصب کنید که همین فایل را مستقیم پخش می‌کنند.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
            <Button label="پخش با VLC و پلیرهای دیگر" icon="external" onPress={() => openExternalSheet({ kind: 'player', url: current.url, title })} />
            <Button label="باز کردن در تب مرورگر" icon="play" variant="onImage" onPress={() => void Linking.openURL(current.url)} />
            <Button label="کپی لینک" icon="link" variant="onImage" onPress={() => copyLink(current.url)} />
            {!isStreamOnly(current) ? <Button label="دانلود" icon="download" variant="onImage" onPress={() => download(current, title, { forceChooser: true })} /> : null}
            <Button label="بازگشت" variant="onImage" onPress={goBack} />
          </View>
        </View>
      ) : null}

      {/* Error */}
      {status === 'error' && !blocked && !unplayable ? (
        <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, backgroundColor: 'rgba(0,0,0,0.9)' }}>
          <Icon name="alert" size={36} color="#F4F1EA" />
          {(() => {
            const hint = explainPlaybackError(error?.message);
            return (
              <>
                <Text size={17} weight={800} color="#F4F1EA" align="center">
                  {hint.title}
                </Text>
                <Text size={13} color="#C9C5D3" align="center" style={{ maxWidth: 560 }}>
                  {hint.body}
                </Text>
              </>
            );
          })()}
          <Text size={11} color="#8E8A9E" align="center" style={{ maxWidth: 640, writingDirection: 'ltr' }} numberOfLines={4} selectable>
            {Platform.OS === 'web' ? 'MediaError: ' : ''}
            {error?.message ?? 'unknown error'}
            {current ? `\n${current.url}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
            {sources
              .filter((s) => s.url !== current?.url)
              .slice(0, 1)
              .map((s) => (
                <Button key={s.url} label={`امتحان با ${s.quality}`} onPress={() => switchSource(s)} hasTVPreferredFocus={isTV} />
              ))}
            {current ? <Button label="پخش با پلیر دیگر" variant="onImage" icon="external" onPress={() => openExternalSheet({ kind: 'player', url: current.url, title })} /> : null}
            <Button
              label="کپی جزئیات خطا"
              variant="onImage"
              icon="link"
              onPress={() => {
                void Clipboard.setStringAsync(`Vispar ${Platform.OS}\n${error?.message ?? ''}\n${current?.url ?? ''}`);
                toast('جزئیات خطا کپی شد', 'check');
              }}
            />
            <Button label="بازگشت" variant="onImage" onPress={goBack} />
          </View>
        </View>
      ) : null}

      {/* End / next episode */}
      {ended ? (
        <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, backgroundColor: 'rgba(0,0,0,0.75)' }}>
          {ctx.next ? (
            <>
              <Text size={13} color="#C9C5D3">
                قسمت بعد
              </Text>
              <Text size={18} weight={800} color="#F4F1EA" align="center">
                {ctx.next.label}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label={countdown !== null ? `پخش در ${faNum(countdown)}` : 'پخش قسمت بعد'} icon="next" onPress={goNext} hasTVPreferredFocus={isTV} />
                <Button label={countdown !== null ? 'لغو' : 'بازگشت'} variant="onImage" onPress={() => (countdown !== null ? setCountdown(null) : goBack())} />
              </View>
            </>
          ) : (
            <>
              <Text size={18} weight={800} color="#F4F1EA">
                پایان
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button
                  label="پخش دوباره"
                  icon="rewind"
                  onPress={() => {
                    setEnded(false);
                    seekTo(0);
                    player.play();
                  }}
                  hasTVPreferredFocus={isTV}
                />
                <Button label="بازگشت" variant="onImage" onPress={goBack} />
              </View>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}
