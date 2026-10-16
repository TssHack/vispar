import { router } from 'expo-router';
import { memo } from 'react';
import { View } from 'react-native';

import type { Poster } from '@/api/types';
import { progressKey, useIsFavorite, useProgressMap } from '@/library/store';
import { faYear, joinMeta } from '@/lib/format';
import { useSetting } from '@/settings/store';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

import { Art } from './Art';
import { ScorePill } from './Badges';
import { Focusable } from './Focusable';
import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  poster: Pick<Poster, 'id' | 'type' | 'title' | 'image' | 'year' | 'imdb' | 'genres'>;
  width: number;
  /** Show a small "سریال" tag (used in mixed lists). */
  showType?: boolean;
  hasTVPreferredFocus?: boolean;
  onFocus?: () => void;
};

export function openPoster(p: { type: Poster['type']; id: number }) {
  router.push(p.type === 'serie' ? `/series/${p.id}` : `/movie/${p.id}`);
}

export const PosterCard = memo(function PosterCard({ poster, width, showType, hasTVPreferredFocus, onFocus }: Props) {
  const { colors } = useTheme(); // also re-renders when the digit style changes
  const showRatings = useSetting('showRatings');
  const fav = useIsFavorite(poster.type, poster.id);
  const progressMap = useProgressMap();
  const prog = poster.type === 'movie' ? progressMap[progressKey('movie', poster.id)] : undefined;
  const pct = prog && prog.duration ? Math.min(1, prog.position / prog.duration) : 0;
  const meta = joinMeta(faYear(poster.year), poster.genres[0]?.title);
  // On narrow cards the series tag already fills the corner; skip the bookmark mark there.
  const showFav = fav && !(showType && poster.type === 'serie' && width < 150);

  return (
    <Focusable
      onPress={() => openPoster(poster)}
      onFocus={onFocus}
      grow
      ringRadius={radius.poster}
      accessibilityRole="link"
      accessibilityLabel={joinMeta(poster.title, meta, fav ? 'در لیست من' : null)}
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={{ width, gap: 6 }}
    >
      <Art uri={poster.image} seed={poster.id} radius={radius.poster} style={{ width, height: Math.round(width * 1.5) }}>
        {showRatings ? <ScorePill score={poster.imdb} /> : null}
        <View style={{ position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 4 }}>
          {showType && poster.type === 'serie' ? (
            <View style={{ backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 7 }}>
              <Text size={10} weight={800} color={colors.onAccent} line={1.6}>
                سریال
              </Text>
            </View>
          ) : null}
          {showFav ? (
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(8,8,12,0.75)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="bookmarkFilled" size={12} color={colors.accent} />
            </View>
          ) : null}
        </View>
        {pct > 0.02 ? (
          <View style={{ position: 'absolute', left: 8, right: 8, bottom: 8, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden', direction: 'ltr' }}>
            <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: colors.accent }} />
          </View>
        ) : null}
      </Art>
      <Text size={13} weight={600} numberOfLines={1}>
        {poster.title}
      </Text>
      {meta ? (
        <Text size={12} color="muted" numberOfLines={1} line={1.4}>
          {meta}
        </Text>
      ) : null}
    </Focusable>
  );
});
