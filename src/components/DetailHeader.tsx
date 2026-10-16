import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { knownPosters } from '@/api/hooks';
import type { Poster } from '@/api/types';
import { useLayout } from '@/hooks/useLayout';
import { toggleFavorite, useIsFavorite } from '@/library/store';
import { faNum, faScore, faYear, joinMeta } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

import { TopNav } from './AppNav';
import { Art } from './Art';
import { ImdbBadge } from './Badges';
import { Button } from './Button';
import { Focusable } from './Focusable';
import { Icon } from './Icon';
import { Rail } from './Rail';
import { Text } from './Text';
import { toast } from './Toast';

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function RoundButton({ icon, label, onPress }: { icon: 'back' | 'share'; label: string; onPress: () => void }) {
  return (
    <Focusable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      ringRadius={14}
      style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(8,8,12,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} size={20} color="#F4F1EA" />
    </Focusable>
  );
}

export function sharePoster(p: Pick<Poster, 'type' | 'id' | 'title'>) {
  const path = p.type === 'serie' ? `/series/${p.id}` : `/movie/${p.id}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) navigator.share({ title: p.title, url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => toast('لینک صفحه کپی شد', 'check'));
    return;
  }
  Share.share({ message: `${p.title} — ویسپار\nvispar:/${path}` }).catch(() => {});
}

/** Bookmark + share, shown next to each page's primary action. */
export function SecondaryActions({ poster }: { poster: Poster }) {
  const fav = useIsFavorite(poster.type, poster.id);
  return (
    <>
      <Button
        icon={fav ? 'bookmarkFilled' : 'bookmark'}
        variant="surface"
        size="lg"
        accessibilityLabel={fav ? 'حذف از لیست من' : 'افزودن به لیست من'}
        onPress={() => {
          const on = toggleFavorite(poster);
          toast(on ? 'به لیست من اضافه شد' : 'از لیست من حذف شد', on ? 'bookmarkFilled' : 'bookmark');
        }}
      />
      <Button icon="share" variant="surface" size="lg" accessibilityLabel="اشتراک‌گذاری" onPress={() => sharePoster(poster)} />
    </>
  );
}

/** Same type, sharing a genre, best-rated first. Built from what the app already loaded. */
function useSimilar(poster: Poster) {
  return useMemo(() => {
    const titles = new Set(poster.genres.map((g) => g.title));
    if (!titles.size) return [];
    return knownPosters()
      .filter((p) => p.type === poster.type && p.id !== poster.id)
      .map((p) => ({ p, score: p.genres.filter((g) => titles.has(g.title)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.p.imdb - a.p.imdb)
      .slice(0, 16)
      .map((x) => x.p);
  }, [poster]);
}

type Props = {
  poster: Poster;
  extraMeta?: string;
  /** Primary action row (play button etc.); SecondaryActions are appended. */
  actions?: React.ReactNode;
  children?: React.ReactNode;
};

/** Shared layout for movie and series pages: backdrop, poster, info, actions, sections, similar. */
export function DetailHeader({ poster, extraMeta, actions, children }: Props) {
  const { colors } = useTheme();
  const { isWide, isTV, isWeb, gutter, maxContent } = useLayout();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const similar = useSimilar(poster);
  const big = isWide || isTV;
  const backdropH = big ? 460 : 340;
  const posterW = big ? 220 : 108;

  const meta = joinMeta(
    faYear(poster.year),
    poster.duration ? faNum(poster.duration) : null,
    extraMeta,
    poster.country.map((c) => c.title).filter(Boolean).slice(0, 2).join('، '),
  );
  const genres = poster.genres.filter((g, i, all) => all.findIndex((x) => x.title === g.title) === i);

  const info = (
    <View style={{ flex: 1, gap: 10, paddingBottom: big ? 0 : 4 }}>
      {poster.type === 'serie' ? (
        <View style={{ alignSelf: 'flex-start', backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 10 }}>
          <Text size={12} weight={700} line={1.8}>
            سریال
          </Text>
        </View>
      ) : null}
      <Text size={big ? 44 : 26} weight={800} line={1.2} accessibilityRole="header">
        {poster.title}
      </Text>
      {meta ? (
        <Text size={big ? 15 : 13} color="text2">
          {meta}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <ImdbBadge score={poster.imdb} size="md" />
        {faScore(poster.rating) ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface2, borderRadius: 7, paddingHorizontal: 8 }}>
            <Icon name="star" size={12} color={colors.accent} />
            <Text size={12} weight={700} line={1.8}>
              ویسپار {faScore(poster.rating)}
            </Text>
          </View>
        ) : null}
      </View>
      {big && genres.length ? <GenreChips genres={genres.map((g) => g.title)} /> : null}
    </View>
  );

  const description = poster.description ? (
    <View style={{ gap: 6, maxWidth: 820 }}>
      <Text size={16} weight={800} accessibilityRole="header">
        داستان
      </Text>
      <Text size={big ? 15 : 14} color="text2" line={1.9} numberOfLines={expanded ? undefined : 4}>
        {poster.description}
      </Text>
      {poster.description.length > 180 ? (
        <Focusable onPress={() => setExpanded((e) => !e)} accessibilityRole="button" ringRadius={8} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
          <Text size={13} weight={700} color="accentText">
            {expanded ? 'بستن' : 'بیشتر بخوانید'}
          </Text>
        </Focusable>
      ) : null}
    </View>
  ) : null;

  const actionRow = (
    <View style={{ flexDirection: 'row', gap: 10, maxWidth: big ? 640 : undefined }}>
      {actions}
      <SecondaryActions poster={poster} />
    </View>
  );

  return (
    <View>
      {isWeb && isWide ? <TopNav /> : null}
      <Art uri={poster.cover || poster.image} seed={poster.id} radius={0} style={{ height: backdropH }}>
        <LinearGradient colors={['rgba(8,8,12,0.45)', 'rgba(8,8,12,0)', 'rgba(8,8,12,0.6)', colors.bg]} locations={[0, 0.3, 0.7, 1]} style={StyleSheet.absoluteFill} />
      </Art>
      {!isTV && !(isWeb && isWide) ? (
        <View style={{ position: 'absolute', top: insets.top + 12, right: gutter, left: gutter, flexDirection: 'row', justifyContent: 'space-between' }}>
          <RoundButton icon="back" label="بازگشت" onPress={goBack} />
        </View>
      ) : null}

      <View style={{ marginTop: -(big ? 260 : 110), paddingHorizontal: gutter, gap: big ? 28 : 18, width: '100%', maxWidth: big ? maxContent : undefined, alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: big ? 'flex-start' : 'flex-end', gap: big ? 32 : 16 }}>
          <Art
            uri={poster.image}
            seed={poster.id}
            radius={radius.poster}
            style={{ width: posterW, height: posterW * 1.5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
          />
          {big ? (
            <View style={{ flex: 1, gap: 20, paddingTop: 80 }}>
              {info}
              {actionRow}
              {description}
            </View>
          ) : (
            info
          )}
        </View>

        {!big && genres.length ? <GenreChips genres={genres.map((g) => g.title)} /> : null}
        {!big ? actionRow : null}
        {!big ? description : null}
        {children}
      </View>

      {similar.length ? (
        <View style={{ width: '100%', maxWidth: big ? maxContent : undefined, alignSelf: 'center', marginTop: 12 }}>
          <Rail title={poster.type === 'serie' ? 'سریال‌های مشابه' : 'فیلم‌های مشابه'} items={similar} />
        </View>
      ) : null}
    </View>
  );
}

function GenreChips({ genres }: { genres: string[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {genres.map((g) => (
        <Focusable
          key={g}
          onPress={() => router.navigate({ pathname: '/movies', params: { genre: g } })}
          accessibilityRole="link"
          accessibilityLabel={`ژانر ${g}`}
          ringRadius={999}
          style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: colors.line }}
        >
          <Text size={12} color="text2">
            {g}
          </Text>
        </Focusable>
      ))}
    </View>
  );
}
