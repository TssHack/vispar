import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { fontFor, type Weight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';
import type { Palette } from '@/theme/tokens';

type Props = TextProps & {
  size?: number;
  weight?: Weight;
  color?: keyof Palette | (string & {});
  /** Line height as a multiple of size. */
  line?: number;
  align?: TextStyle['textAlign'];
};

export function Text({ size = 14, weight = 400, color = 'text', line = 1.6, align, style, ...rest }: Props) {
  const { colors } = useTheme();
  const resolved = (colors as Record<string, string>)[color] ?? color;
  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: fontFor(weight),
          fontSize: size,
          lineHeight: Math.round(size * line),
          color: resolved,
          textAlign: align,
          writingDirection: 'rtl',
        },
        style,
      ]}
    />
  );
}
