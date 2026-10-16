import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

import { Focusable } from './Focusable';
import { Text } from './Text';

type Props = { label: string; selected?: boolean; onPress?: () => void };

export function Chip({ label, selected, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <Focusable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      ringRadius={radius.pill}
      style={{
        height: 36,
        paddingHorizontal: 16,
        borderRadius: radius.pill,
        justifyContent: 'center',
        backgroundColor: selected ? colors.chipActiveBg : colors.surface,
        borderWidth: selected ? 0 : 1,
        borderColor: colors.line,
      }}
    >
      <Text size={13} weight={selected ? 700 : 600} color={selected ? colors.chipActiveText : 'text2'} line={1.4}>
        {label}
      </Text>
    </Focusable>
  );
}
