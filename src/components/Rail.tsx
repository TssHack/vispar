import { Link, type Href } from 'expo-router';
import { FlatList, View } from 'react-native';

import type { Poster } from '@/api/types';
import { useLayout } from '@/hooks/useLayout';
import type { Progress } from '@/library/store';

import { Icon } from './Icon';
import { ContinueCard } from './LandscapeCard';
import { PosterCard } from './PosterCard';
import { ErrorState, Skeleton } from './States';
import { Text } from './Text';

export function SectionHeader({ title, seeAll, subtitle }: { title: string; seeAll?: Href; subtitle?: string }) {
  const { gutter, isTV } = useLayout();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: gutter, marginBottom: 12, gap: 12 }}>
      <View style={{ flexShrink: 1 }}>
        <Text size={isTV ? 22 : 18} weight={800} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text size={12} color="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {seeAll && !isTV ? (
        <Link href={seeAll} accessibilityLabel={`همه‌ی ${title}`} style={{ padding: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text size={13} weight={600} color="text2">
              همه
            </Text>
            <Icon name="chevronLeft" size={16} color="text2" />
          </View>
        </Link>
      ) : null}
    </View>
  );
}

type RailProps = {
  title: string;
  subtitle?: string;
  items: Poster[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  seeAll?: Href;
  onEndReached?: () => void;
  firstFocused?: boolean;
  showType?: boolean;
};

/** Horizontal row of posters. */
export function Rail({ title, subtitle, items, loading, error, onRetry, seeAll, onEndReached, firstFocused, showType }: RailProps) {
  const { gutter, posterWidth, isTV } = useLayout();
  const gap = isTV ? 22 : 12;
  if (!loading && !error && items.length === 0) return null;
  return (
    <View style={{ marginTop: 24 }}>
      <SectionHeader title={title} subtitle={subtitle} seeAll={seeAll} />
      {error && items.length === 0 ? (
        <ErrorState error={error} onRetry={onRetry} compact />
      ) : loading && items.length === 0 ? (
        <View style={{ flexDirection: 'row', gap, paddingHorizontal: gutter, overflow: 'hidden' }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} style={{ width: posterWidth, height: posterWidth * 1.5, borderRadius: 14 }} />
          ))}
        </View>
      ) : (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(p) => `${p.type}-${p.id}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: gutter, gap, paddingVertical: isTV ? 12 : 4 }}
          renderItem={({ item, index }) => <PosterCard poster={item} width={posterWidth} showType={showType} hasTVPreferredFocus={firstFocused && index === 0} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.6}
          initialNumToRender={7}
          windowSize={5}
        />
      )}
    </View>
  );
}

/** "Continue watching" row of landscape cards with progress. */
export function ContinueRail({ title, items, seeAll }: { title: string; items: Progress[]; seeAll?: Href }) {
  const { gutter, cardWidth, isTV } = useLayout();
  if (!items.length) return null;
  return (
    <View style={{ marginTop: 24 }}>
      <SectionHeader title={title} seeAll={seeAll} />
      <FlatList
        horizontal
        data={items}
        keyExtractor={(p) => p.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: gutter, gap: isTV ? 22 : 12, paddingVertical: isTV ? 12 : 4 }}
        renderItem={({ item }) => <ContinueCard item={item} width={cardWidth} removable={!isTV} />}
      />
    </View>
  );
}
