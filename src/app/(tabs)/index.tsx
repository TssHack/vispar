import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { flatten, fromSaved, useMovies, useSeries } from '@/api/hooks';
import type { Poster } from '@/api/types';
import { Chip } from '@/components/Chip';
import { Focusable } from '@/components/Focusable';
import { Footer } from '@/components/Footer';
import { HeroCarousel } from '@/components/Hero';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { ContinueRail, Rail } from '@/components/Rail';
import { optionsFrom } from '@/filters/filters';
import { useLayout } from '@/hooks/useLayout';
import { continueWatching, useFavorites, useProgressMap } from '@/library/store';
import { settingsStore } from '@/settings/store';
import { useTheme } from '@/theme/ThemeProvider';

function HeaderButton({ icon, label, onPress }: { icon: 'search' | 'settings'; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Focusable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      ringRadius={14}
      style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} size={20} />
    </Focusable>
  );
}

export default function Home() {
  const { colors } = useTheme();
  const { isTV, isWide, isWeb, gutter, bp, maxContent } = useLayout();
  const insets = useSafeAreaInsets();
  const sections = settingsStore.use((s) => s.home);
  const movies = useMovies();
  const series = useSeries();
  const favorites = useFavorites();
  const progress = useProgressMap();

  const movieList = useMemo(() => flatten(movies.data?.pages), [movies.data]);
  const seriesList = useMemo(() => flatten(series.data?.pages), [series.data]);
  const both = useMemo(() => [...movieList, ...seriesList], [movieList, seriesList]);
  const genres = useMemo(() => optionsFrom(both).genres, [both]);
  const featured = useMemo(() => {
    const withCover = (l: Poster[]) => l.filter((p) => p.cover);
    return [...withCover(movieList).slice(0, 4), ...withCover(seriesList).slice(0, 2)].slice(0, 6);
  }, [movieList, seriesList]);
  const topRated = useMemo(() => [...both].filter((p) => p.imdb > 0).sort((a, b) => b.imdb - a.imdb).slice(0, 20), [both]);
  const cont = useMemo(() => continueWatching(progress).slice(0, 15), [progress]);
  const myList = useMemo(() => favorites.map((f) => fromSaved(f.poster)), [favorites]);
  const genreRails = useMemo(
    () => genres.slice(0, 3).map((g) => ({ g, items: both.filter((p) => p.genres.some((x) => x.title === g)).slice(0, 20) })).filter((r) => r.items.length >= 4),
    [genres, both],
  );
  const phone = bp === 'phone' || bp === 'tablet';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: phone ? insets.top : 0, paddingBottom: 40 }}>
      {phone ? (
        <View style={{ height: 60, paddingHorizontal: gutter, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Logo size={30} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <HeaderButton icon="settings" label="تنظیمات" onPress={() => router.navigate('/settings')} />
            <HeaderButton icon="search" label="جستجو" onPress={() => router.navigate('/search')} />
          </View>
        </View>
      ) : null}

      <View style={{ width: '100%', maxWidth: isWide ? maxContent : undefined, alignSelf: 'center' }}>
        <HeroCarousel items={featured} loading={movies.isLoading} preferredFocus={isTV} />

        {genres.length > 0 && !isTV ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: gutter, paddingTop: 18 }} accessibilityLabel="ژانرها">
            {genres.slice(0, 12).map((g) => (
              <Chip key={g} label={g} onPress={() => router.navigate({ pathname: '/movies', params: { genre: g } })} />
            ))}
          </ScrollView>
        ) : null}

        {sections.continueWatching ? <ContinueRail title="ادامه‌ی تماشا" items={cont} seeAll="/library" /> : null}
        {sections.myList && myList.length ? <Rail title="لیست من" items={myList} seeAll="/library" showType /> : null}

        {sections.movies ? (
          <Rail
            title="تازه‌ترین فیلم‌ها"
            items={movieList}
            loading={movies.isLoading}
            error={movies.error}
            onRetry={() => movies.refetch()}
            seeAll="/movies"
            firstFocused={false}
            onEndReached={() => movies.hasNextPage && !movies.isFetchingNextPage && movies.fetchNextPage()}
          />
        ) : null}
        {sections.series ? (
          <Rail
            title="سریال‌های جدید"
            items={seriesList}
            loading={series.isLoading}
            error={series.error}
            onRetry={() => series.refetch()}
            seeAll="/series"
            onEndReached={() => series.hasNextPage && !series.isFetchingNextPage && series.fetchNextPage()}
          />
        ) : null}
        {sections.topRated && topRated.length >= 4 ? <Rail title="برترین‌ها از نظر IMDb" subtitle="از میان فیلم‌ها و سریال‌های تازه" items={topRated} showType /> : null}
        {sections.genres ? genreRails.map((r) => <Rail key={r.g} title={r.g} items={r.items} showType />) : null}
      </View>

      {isWeb && isWide ? <Footer /> : null}
    </ScrollView>
  );
}
