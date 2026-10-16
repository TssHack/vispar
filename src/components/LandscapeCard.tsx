import { router } from 'expo-router';
import { memo } from 'react';
import { View } from 'react-native';

import { removeProgress, type Progress } from '@/library/store';
import { faClock, faNum } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

import { Art } from './Art';
import { Focusable } from './Focusable';
import { Icon } from './Icon';
import { Text } from './Text';

/** Resumes straight into the player; the player resolves sources and seeks to the saved spot. */
export function resume(p: Progress) {
  router.push({
    pathname: '/player',
    params: {
      type: p.poster.type,
      id: String(p.poster.id),
      title: p.poster.title,
      ...(p.episode ? { s: String(p.episode.seasonIndex), e: String(p.episode.episodeIndex) } : {}),
    },
  });
}

export const ContinueCard = memo(function ContinueCard({ item, width, removable = true }: { item: Progress; width: number; removable?: boolean }) {
  const { colors } = useTheme();
  const pct = item.duration ? Math.min(1, item.position / item.duration) : 0;
  const left = Math.max(0, item.duration - item.position);
  const sub = item.episode
    ? `فصل ${faNum(item.episode.seasonIndex + 1)} · قسمت ${faNum(item.episode.episodeIndex + 1)}`
    : `${faNum(Math.ceil(left / 60))} دقیقه مانده`;

  return (
    <View style={{ width }}>
      <Focusable
        onPress={() => resume(item)}
        grow
        ringRadius={14}
        accessibilityRole="button"
        accessibilityLabel={`ادامه‌ی ${item.poster.title}، ${sub}`}
        style={{ gap: 8 }}
      >
        <Art uri={item.poster.cover || item.poster.image} seed={item.poster.id} radius={14} style={{ width, height: Math.round(width * 0.5625), alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(8,8,12,0.6)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="play" size={16} color="#F4F1EA" />
          </View>
          <View style={{ position: 'absolute', left: 10, bottom: 8, paddingHorizontal: 6, borderRadius: 6, backgroundColor: 'rgba(8,8,12,0.7)' }}>
            <Text size={11} weight={700} color="#F4F1EA" line={1.6}>
              {faClock(item.position)}
            </Text>
          </View>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.25)', direction: 'ltr' }}>
            <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: colors.accent }} />
          </View>
        </Art>
        <View style={{ paddingEnd: removable ? 36 : 0 }}>
          <Text size={13} weight={700} numberOfLines={1}>
            {item.poster.title}
          </Text>
          <Text size={12} color="muted" numberOfLines={1}>
            {sub}
          </Text>
        </View>
      </Focusable>
      {removable ? (
        <Focusable
          onPress={() => removeProgress(item.key)}
          accessibilityRole="button"
          accessibilityLabel={`حذف ${item.poster.title} از ادامه‌ی تماشا`}
          ringRadius={12}
          style={{ position: 'absolute', bottom: 2, left: 0, width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="close" size={16} color="muted" />
        </Focusable>
      ) : null}
    </View>
  );
});
