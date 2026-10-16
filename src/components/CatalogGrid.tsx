import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Poster } from '@/api/types';
import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/theme/ThemeProvider';

import { PosterCard } from './PosterCard';
import { EmptyState, ErrorState, Skeleton } from './States';
import { Text } from './Text';

type Props = {
  title: string;
  items: Poster[];
  loading: boolean;
  error: unknown;
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  loadingMore?: boolean;
  header?: React.ReactNode;
  showType?: boolean;
  emptyTitle?: string;
  /** Custom empty state (e.g. for active filters). */
  empty?: React.ReactElement;
};

/** Responsive poster grid with infinite scroll. */
export function CatalogGrid({
  title,
  items,
  loading,
  error,
  refreshing,
  onRefresh,
  onEndReached,
  loadingMore,
  header,
  showType,
  emptyTitle = 'چیزی پیدا نشد',
  empty,
}: Props) {
  const { colors } = useTheme();
  const { width, gutter, isTV, isWide, posterWidth } = useLayout();
  const insets = useSafeAreaInsets();
  const railWidth = isTV ? 96 : 0;
  const usable = Math.min(width - railWidth, isWide ? 1440 : width) - gutter * 2;
  const gap = isTV ? 22 : isWide ? 18 : 10;
  const minCell = isWide || isTV ? posterWidth : Math.round(posterWidth * 0.88);
  const columns = Math.max(3, Math.floor((usable + gap) / (minCell + gap)));
  const cell = Math.floor((usable - gap * (columns - 1)) / columns);
  const phone = !isTV && !isWide;

  const Header = (
    <View style={{ gap: 14, paddingBottom: 16 }}>
      <Text size={isTV ? 30 : 26} weight={800} accessibilityRole="header">
        {title}
      </Text>
      {header}
    </View>
  );

  const skeleton = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {Array.from({ length: columns * 3 }).map((_, i) => (
        <Skeleton key={i} style={{ width: cell, height: cell * 1.5, borderRadius: 14 }} />
      ))}
    </View>
  );

  return (
    <FlatList
      key={columns}
      style={{ flex: 1, backgroundColor: colors.bg }}
      data={items}
      numColumns={columns}
      keyExtractor={(p) => `${p.type}-${p.id}`}
      columnWrapperStyle={{ gap }}
      contentContainerStyle={{
        paddingTop: phone ? insets.top + 14 : 14,
        paddingHorizontal: gutter,
        paddingBottom: 32,
        gap: gap + 8,
        width: '100%',
        maxWidth: isWide ? 1440 : undefined,
        alignSelf: 'center',
      }}
      ListHeaderComponent={Header}
      ListEmptyComponent={
        loading ? skeleton : error ? <ErrorState error={error} onRetry={onRefresh} /> : empty ?? <EmptyState title={emptyTitle} />
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} /> : undefined}
      renderItem={({ item, index }) => (
        <PosterCard poster={item} width={cell} showType={showType} hasTVPreferredFocus={isTV && index === 0} />
      )}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={onRefresh && !isTV ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined}
    />
  );
}
