import { useMemo } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { cueAt, type Cue } from '@/lib/subtitles/parse';

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
};

export function SubtitleOverlay({ cues, time, offsetMs, style, bottomInset, scale = 1 }: Props) {
  // The cue lookup is a binary search and the offset is cheap, but both must stay out of the way of
  // the 2 Hz player tick, hence the memo on the inputs that actually change.
  const cue = useMemo(() => cueAt(cues, time - offsetMs / 1000), [cues, time, offsetMs]);
  if (!cue) return null;

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
        {cue.lines.map((line, index) => (
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
