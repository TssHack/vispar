import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

import { Focusable } from './Focusable';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Variant = 'primary' | 'ghost' | 'surface' | 'onImage';

type Props = {
  label?: string;
  icon?: IconName;
  variant?: Variant;
  size?: 'md' | 'lg';
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Required when there is no visible label. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  hasTVPreferredFocus?: boolean;
};

export function Button({
  label,
  icon,
  variant = 'primary',
  size = 'md',
  onPress,
  disabled,
  loading,
  accessibilityLabel,
  style,
  hasTVPreferredFocus,
}: Props) {
  const { colors } = useTheme();
  const height = size === 'lg' ? 54 : 48;
  const iconOnly = !label;

  const look: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.accent, fg: colors.onAccent },
    ghost: { bg: 'transparent', fg: colors.text, border: colors.lineStrong },
    surface: { bg: colors.surface, fg: colors.text, border: colors.lineStrong },
    onImage: { bg: 'rgba(255,255,255,0.1)', fg: '#F4F1EA', border: 'rgba(255,255,255,0.18)' },
  };
  const v = look[variant];

  return (
    <Focusable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      ringRadius={radius.button}
      {...(hasTVPreferredFocus ? ({ hasTVPreferredFocus: true } as object) : {})}
      style={[
        {
          height,
          minWidth: height,
          paddingHorizontal: iconOnly ? 0 : 22,
          borderRadius: radius.button,
          backgroundColor: v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon ? <Icon name={icon} size={icon === 'play' ? 16 : 20} color={v.fg} /> : null}
          {label ? (
            <Text size={size === 'lg' ? 16 : 15} weight={800} color={v.fg} line={1.3}>
              {label}
            </Text>
          ) : null}
        </View>
      )}
    </Focusable>
  );
}
