import { useState, type ReactNode } from 'react';
import { Platform, Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /** Extra style applied while focused (D-pad on TV, keyboard on web). */
  focusStyle?: StyleProp<ViewStyle>;
  /** Draw the accent ring when focused. */
  ring?: boolean;
  /** Corner radius of the ring; match the control's own radius. */
  ringRadius?: number;
  /** Scale up slightly when focused (TV posters). */
  grow?: boolean;
  children: ReactNode | ((state: { focused: boolean; pressed: boolean }) => ReactNode);
};

/**
 * Pressable with a visible focus state. On Android TV focus moves with the D-pad, so every
 * control needs one; the same ring is the keyboard focus style on web. The ring is an overlay,
 * so focusing never shifts layout.
 */
export function Focusable({
  style,
  focusStyle,
  ring = true,
  ringRadius = 16,
  grow = false,
  children,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      focusable
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={({ pressed }) => [
        style,
        Platform.OS === 'web' ? ({ cursor: 'pointer', outlineStyle: 'none' } as unknown as ViewStyle) : null,
        pressed ? { opacity: 0.8 } : null,
        focused && grow ? { transform: [{ scale: 1.06 }] } : null,
        focused ? focusStyle : null,
      ]}
    >
      {({ pressed }) => (
        <>
          {typeof children === 'function' ? children({ focused, pressed }) : children}
          {focused && ring ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                bottom: -4,
                left: -4,
                borderRadius: ringRadius + 4,
                borderWidth: 3,
                borderColor: colors.accent,
              }}
            />
          ) : null}
        </>
      )}
    </Pressable>
  );
}
