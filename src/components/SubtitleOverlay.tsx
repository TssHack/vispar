import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { cuesAt, nextCueChange, type Cue } from '@/lib/subtitles/parse';

/**
 * Renders the active cue over the video.
 *
 * Deliberately a plain absolutely-positioned view rather than anything clever: it must sit above the
 * video but below the controls, must never swallow a tap (that would break double-tap seeking), and
 * must not re-layout the player.
 */

export type OverlayStyle = {
  size: 'sm' | 'md' | 'lg';
  background: 'none' | 'soft' | 'solid';
};

const FONT_SIZE: Record<OverlayStyle['size'], number> = { sm: 14, md: 18, lg: 24 };
const LINE_HEIGHT: Record<OverlayStyle['size'], number> = { sm: 1.5, md: 1.5, lg: 1.45 };
const PADDING: Record<OverlayStyle['background'], number> = { none: 0, soft: 6, solid: 9 };
const BACKGROUND: Record<OverlayStyle['background'], string> = {
  none: 'transparent',
  soft: 'rgba(8,8,12,0.55)',
  solid: 'rgba(8,8,12,0.86)',
};

type Props = {
  cues: Cue[];
  /** Playback position in seconds, excluding the user's offset. */
  time: number;
  /** Sync correction, in milliseconds; positive means the subtitles appear later. */
  offsetMs: number;
  style: OverlayStyle;
  /** Kept above the seek bar so the two never overlap. */
  bottomInset: number;
  /** Scales text for TV, where 18px is unreadable from a sofa. */
  scale?: number;
  /** While playing, the overlay runs its own clock between the player's 0.5 s ticks. */
  playing?: boolean;
  rate?: number;
};

/** How far past the last player tick the overlay's own clock may run (it stops if ticks stop, e.g. buffering). */
const MAX_EXTRAPOLATION = 1.5;

/**
 * The playback position between player ticks. `timeUpdate` arrives every 0.5 s, so a line could
 * appear up to half a second late, and a short line in fast dialogue could be skipped (#86). This
 * re-renders exactly when the next cue starts or ends, from the last tick and the playback rate.
 */
export function useCueClock(cues: Cue[], time: number, playing: boolean, rate: number): number {
  const tickAt = useRef({ time, at: Date.now() });
  if (tickAt.current.time !== time) tickAt.current = { time, at: Date.now() };
  // The extrapolated position belongs to one tick; a new tick replaces it.
  const [ahead, setAhead] = useState<{ tick: number; now: number } | null>(null);
  const now = ahead && ahead.tick === time ? ahead.now : time;
  useEffect(() => {
    if (!playing || rate <= 0) return;
    const next = nextCueChange(cues, now);
    if (next === null || next - time > MAX_EXTRAPOLATION) return;
    const wait = Math.max(0, ((next - now) / rate) * 1000) + 10;
    const timer = setTimeout(() => {
      const elapsed = ((Date.now() - tickAt.current.at) / 1000) * rate;
      setAhead({ tick: time, now: time + Math.min(elapsed, MAX_EXTRAPOLATION) });
    }, wait);
    return () => clearTimeout(timer);
  }, [cues, now, time, playing, rate]);
  return now;
}

export function SubtitleOverlay({ cues, time, offsetMs, style, bottomInset, scale = 1, playing = false, rate = 1 }: Props) {
  const clock = useCueClock(cues, time - offsetMs / 1000, playing, rate);
  // Overlapping cues (fast dialogue) are all shown, earliest on top.
  const lines = cuesAt(cues, clock).flatMap((c) => c.lines);
  if (!lines.length) return null;

  const fontSize = Math.round(FONT_SIZE[style.size] * scale);
  const padding = Math.round(PADDING[style.background] * scale);

  return (
    <View
      pointerEvents="none"
      // Not a live region: subtitles repeat the audio, and announcing every cue would talk over it.
      accessibilityLiveRegion="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: bottomInset,
        alignItems: 'center',
        paddingHorizontal: Math.round(24 * scale),
      }}
    >
      <View
        style={{
          maxWidth: '92%',
          backgroundColor: BACKGROUND[style.background],
          borderRadius: padding ? Math.round(padding * 1.6) : 0,
          paddingHorizontal: padding ? Math.round(padding * 2) : 0,
          paddingVertical: padding ? Math.round(padding * 1.1) : 0,
        }}
      >
        {lines.map((line, index) => (
          <Text
            key={index}
            // Persian text needs the right base direction; mixed Latin words inside a cue then keep
            // their own order instead of flipping the whole line.
            style={{ writingDirection: 'rtl' }}
            align="center"
            size={fontSize}
            weight={600}
            line={LINE_HEIGHT[style.size]}
            color="#FFFFFF"
          >
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}
