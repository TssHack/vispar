import { View } from 'react-native';

import { faScore } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

import { Icon } from './Icon';
import { Text } from './Text';

export function ImdbBadge({ score, size = 'sm' }: { score: number; size?: 'sm' | 'md' }) {
  const { colors } = useTheme();
  const s = faScore(score);
  if (!s) return null;
  return (
    <View
      accessibilityLabel={`امتیاز IMDb ${s}`}
      style={{ backgroundColor: colors.imdb, borderRadius: 6, paddingHorizontal: size === 'md' ? 8 : 7, paddingVertical: 2 }}
    >
      <Text size={size === 'md' ? 12 : 11} weight={800} color={colors.onImdb} line={1.5}>
        IMDb {s}
      </Text>
    </View>
  );
}

/** Small rating pill over poster art (always on an image, so it uses a fixed dark scrim). */
export function ScorePill({ score }: { score: number }) {
  const { colors } = useTheme();
  const s = faScore(score);
  if (!s) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: radius.pill,
        backgroundColor: 'rgba(8,8,12,0.75)',
      }}
    >
      <Icon name="star" size={11} color={colors.accent} />
      <Text size={11} weight={700} color="#F4F1EA" line={1.5}>
        {s}
      </Text>
    </View>
  );
}

export function Tag({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'neutral' }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: radius.pill,
        backgroundColor: tone === 'accent' ? 'rgba(242,181,68,0.18)' : 'rgba(255,255,255,0.12)',
      }}
    >
      <Text size={12} weight={700} color={tone === 'accent' ? colors.accent : '#F4F1EA'} line={1.5}>
        {label}
      </Text>
    </View>
  );
}
