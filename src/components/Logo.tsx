import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

/**
 * The Vispar mark: a V that cradles a play button (assets/brand/logo-mark.svg).
 * `onDark` keeps the light play triangle (for dark tiles); otherwise it follows the theme.
 */
export function LogoMark({ size = 32, onDark = false }: { size?: number; onDark?: boolean }) {
  const { name } = useTheme();
  // Unique per instance: a gradient defined inside a hidden copy (e.g. an inactive tab) cannot be referenced.
  const gid = `vispar-amber-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const play = onDark || name === 'dark' ? '#F7F3EA' : '#16141C';
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={gid} x1="0.15" y1="0.1" x2="0.85" y2="0.95">
            <Stop offset="0" stopColor="#FFE0A0" />
            <Stop offset="0.5" stopColor="#F2B544" />
            <Stop offset="1" stopColor="#DB8520" />
          </LinearGradient>
        </Defs>
        <Path
          d="M24 27 L50 73 L76 27"
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={11}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path d="M43.5 31 L43.5 47 L57 39 Z" fill={play} stroke={play} strokeWidth={3.2} strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

export function Logo({ size = 30, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="ویسپار"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      <LogoMark size={size} />
      {wordmark ? (
        <Text size={size * 0.75} weight={800} line={1.2}>
          ویسپار
        </Text>
      ) : null}
    </View>
  );
}
