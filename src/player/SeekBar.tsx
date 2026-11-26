import { useEffect, useRef, useState } from 'react';
import { findNodeHandle, Platform, Pressable, View, type GestureResponderEvent, type HostInstance, type LayoutChangeEvent } from 'react-native';

import { Text } from '@/components/Text';
import { faClock } from '@/lib/format';

type Props = {
  position: number;
  duration: number;
  buffered: number;
  accent: string;
  onSeek: (seconds: number) => void;
  /** Called while dragging, so the overlay stays visible. */
  onScrubbing?: (active: boolean) => void;
  /**
   * Android TV: the bar becomes a focus stop. While it is focused, left/right stay on it (the player
   * turns them into seeks) and select calls `onSelect`.
   */
  tv?: boolean;
  preferredFocus?: boolean;
  onFocusChange?: (focused: boolean) => void;
  onSelect?: () => void;
};

/**
 * Timeline scrubber. Media timelines stay left-to-right even in an RTL app, matching the play
 * icon and how every major player draws them.
 */
export function SeekBar({ position, duration, buffered, accent, onSeek, onScrubbing, tv, preferredFocus, onFocusChange, onSelect }: Props) {
  const width = useRef(0);
  const [drag, setDrag] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const self = useRef<HostInstance>(null);
  const [handle, setHandle] = useState<number | undefined>(undefined);
  useEffect(() => {
    // nextFocusLeft/Right are Android view props. findNodeHandle throws on web (the ?tv=1 preview).
    if (tv && Platform.OS === 'android') setHandle(findNodeHandle(self.current) ?? undefined);
  }, [tv]);
  const ratio = (x: number) => Math.min(1, Math.max(0, x / (width.current || 1)));
  const shown = drag ?? (duration ? position / duration : 0);
  const buf = duration ? Math.min(1, buffered / duration) : 0;

  const at = (e: GestureResponderEvent) => ratio(e.nativeEvent.locationX);

  /**
   * Press-and-drag seeking. Touch, a mouse and a TV air mouse all arrive here; on TV the bar is also a
   * focus stop for the remote, and these handlers sit inside it, so a click seeks to the point
   * instead of pressing the focus stop (which toggles play, as the remote's select does) (#86).
   */
  const pointer = {
    onLayout: (e: LayoutChangeEvent) => {
      width.current = e.nativeEvent.layout.width;
    },
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      onScrubbing?.(true);
      setDrag(at(e));
    },
    onResponderMove: (e: GestureResponderEvent) => setDrag(at(e)),
    onResponderRelease: (e: GestureResponderEvent) => {
      const r = at(e);
      setDrag(null);
      onScrubbing?.(false);
      if (duration) onSeek(r * duration);
    },
    onResponderTerminate: () => {
      setDrag(null);
      onScrubbing?.(false);
    },
  };

  return (
    <View style={{ direction: 'ltr', gap: 6 }}>
      {tv ? (
        <Pressable
          ref={self}
          focusable
          {...({ hasTVPreferredFocus: !!preferredFocus, nextFocusLeft: handle, nextFocusRight: handle } as object)}
          accessibilityRole="adjustable"
          accessibilityLabel="نوار پیشرفت"
          accessibilityValue={{ min: 0, max: Math.round(duration), now: Math.round(position), text: `${faClock(position)} از ${faClock(duration)}` }}
          onFocus={() => {
            setFocused(true);
            onFocusChange?.(true);
          }}
          onBlur={() => {
            setFocused(false);
            onFocusChange?.(false);
          }}
          onPress={onSelect}
          style={{ height: 28, justifyContent: 'center' }}
        >
          <View
            {...pointer}
            // Web (?tv=1, desktop): the click would also bubble to the focus stop and toggle play.
            {...(Platform.OS === 'web' ? ({ onClick: (e: { stopPropagation: () => void }) => e.stopPropagation() } as object) : {})}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          />
          <View pointerEvents="none" style={{ height: focused || drag !== null ? 8 : 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' }}>
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${buf * 100}%`, backgroundColor: 'rgba(255,255,255,0.35)' }} />
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${shown * 100}%`, backgroundColor: accent }} />
          </View>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: `${shown * 100}%`,
              marginLeft: focused ? -11 : -8,
              width: focused ? 22 : 16,
              height: focused ? 22 : 16,
              borderRadius: 11,
              backgroundColor: accent,
              borderWidth: focused ? 3 : 2,
              borderColor: '#FFFFFF',
            }}
          />
        </Pressable>
      ) : (
      <View
        {...pointer}
        accessibilityRole="adjustable"
        accessibilityLabel="نوار پیشرفت"
        accessibilityValue={{ min: 0, max: Math.round(duration), now: Math.round(position), text: `${faClock(position)} از ${faClock(duration)}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onSeek(position + (e.nativeEvent.actionName === 'increment' ? 10 : -10))}
        style={{ height: 28, justifyContent: 'center' }}
      >
        <View style={{ height: drag !== null ? 6 : 4, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' }}>
          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${buf * 100}%`, backgroundColor: 'rgba(255,255,255,0.35)' }} />
          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${shown * 100}%`, backgroundColor: accent }} />
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${shown * 100}%`,
            marginLeft: -8,
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: accent,
            borderWidth: 2,
            borderColor: '#FFFFFF',
          }}
        />
        {drag !== null ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: `${drag * 100}%`, bottom: 30, marginLeft: -32, width: 64, alignItems: 'center' }}>
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(8,8,12,0.85)' }}>
              <Text size={12} weight={700} color="#F4F1EA" line={1.6}>
                {faClock(drag * duration)}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text size={12} weight={600} color="#F4F1EA" line={1.4} style={{ writingDirection: 'ltr' }}>
          {faClock(drag !== null ? drag * duration : position)}
        </Text>
        <Text size={12} weight={600} color="#C9C5D3" line={1.4} style={{ writingDirection: 'ltr' }}>
          {duration ? `\u2212${faClock(Math.max(0, duration - (drag !== null ? drag * duration : position)))}` : '--:--'}
        </Text>
      </View>
    </View>
  );
}
