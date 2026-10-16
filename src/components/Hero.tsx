import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';

import type { Poster } from '@/api/types';
import { play } from '@/external/actions';
import { useLayout } from '@/hooks/useLayout';
import { toggleFavorite, useIsFavorite } from '@/library/store';
import { faNum, faYear, joinMeta } from '@/lib/format';
import { pickSource } from '@/lib/sources';
import { getSettings, useSetting } from '@/settings/store';
import { useTheme } from '@/theme/ThemeProvider';
import { cinema, radius } from '@/theme/tokens';

import { Art } from './Art';
import { ImdbBadge, Tag } from './Badges';
import { Button } from './Button';
import { Focusable } from './Focusable';
import { openPoster } from './PosterCard';
import { Skeleton } from './States';
import { Text } from './Text';

function HeroSlide({ poster, preferredFocus }: { poster: Poster; preferredFocus?: boolean }) {
  const { isWide, isTV } = useLayout();
  const fav = useIsFavorite(poster.type, poster.id);
  const big = isWide || isTV;
  const meta = joinMeta(faYear(poster.year), poster.genres.map((g) => g.title).slice(0, 2).join('، '), poster.duration ? faNum(poster.duration) : null);
  const onPlay = () => {
    const src = poster.type === 'movie' ? pickSource(poster.sources, getSettings().defaultQuality) : null;
    if (src) play(src, { type: 'movie', id: poster.id, title: poster.title });
    else openPoster(poster);
  };
  return (
    <>
      <LinearGradient colors={['rgba(8,8,12,0)', 'rgba(8,8,12,0.55)', cinema.scrim]} locations={[0.25, 0.6, 1]} style={StyleSheet.absoluteFill} />
      {big ? <LinearGradient colors={['rgba(8,8,12,0.9)', 'rgba(8,8,12,0)']} start={{ x: 1, y: 0 }} end={{ x: 0.35, y: 0 }} style={StyleSheet.absoluteFill} /> : null}
      <View style={{ padding: big ? 48 : 20, paddingBottom: big ? 56 : 36, gap: 10, maxWidth: big ? 640 : undefined }}>
        <Tag label={poster.type === 'serie' ? 'سریال جدید' : 'تازه اضافه شده'} />
        <Text size={isTV ? 56 : isWide ? 60 : 32} weight={800} color={cinema.onImage} line={1.15} numberOfLines={2}>
          {poster.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <ImdbBadge score={poster.imdb} />
          {meta ? (
            <Text size={big ? 15 : 13} color={cinema.onImage2}>
              {meta}
            </Text>
          ) : null}
        </View>
        {big && poster.description ? (
          <Text size={isTV ? 17 : 16} color={cinema.onImage2} line={1.8} numberOfLines={2}>
            {poster.description}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
          <Button label="پخش" icon="play" size="lg" hasTVPreferredFocus={preferredFocus} onPress={onPlay} style={big ? { paddingHorizontal: 30 } : { flex: 1 }} />
          <Button label="جزئیات" variant="onImage" size="lg" onPress={() => openPoster(poster)} style={big ? undefined : { flex: 1 }} />
          <Button
            icon={fav ? 'bookmarkFilled' : 'bookmark'}
            variant="onImage"
            size="lg"
            accessibilityLabel={fav ? 'حذف از لیست من' : 'افزودن به لیست من'}
            onPress={() => toggleFavorite(poster)}
          />
        </View>
      </View>
    </>
  );
}

/** Featured slider: auto-advances (unless reduced motion), swipeable, with dots. */
export function HeroCarousel({ items, loading, preferredFocus }: { items: Poster[]; loading?: boolean; preferredFocus?: boolean }) {
  const { colors } = useTheme();
  const { isWide, isTV, gutter, width } = useLayout();
  const reduceMotion = useSetting('reduceMotion');
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const height = isTV ? 470 : isWide ? Math.min(620, Math.max(460, width * 0.38)) : width >= 600 ? 440 : 400;
  const count = items.length;
  const indexRef = useRef(index);
  indexRef.current = index;

  const go = (next: number) => {
    if (!count) return;
    const n = (next + count) % count;
    if (reduceMotion) {
      setIndex(n);
      return;
    }
    Animated.timing(fade, { toValue: 0, duration: 160, useNativeDriver: false }).start(() => {
      setIndex(n);
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: false }).start();
    });
  };
  const goRef = useRef(go);
  goRef.current = go;

  useEffect(() => {
    if (count < 2 || paused || reduceMotion || isTV) return;
    const t = setInterval(() => goRef.current(indexRef.current + 1), 7000);
    return () => clearInterval(t);
  }, [count, paused, reduceMotion, isTV]);

  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        // RTL: swiping left reveals the next slide.
        if (g.dx < -40) goRef.current(indexRef.current + 1);
        else if (g.dx > 40) goRef.current(indexRef.current - 1);
      },
    }),
  ).current;

  if (!count) {
    return loading ? (
      <View style={{ paddingHorizontal: isTV ? 0 : gutter }}>
        <Skeleton style={{ height, borderRadius: isTV ? 0 : radius.hero }} />
      </View>
    ) : null;
  }
  const poster = items[Math.min(index, count - 1)];

  return (
    <View style={{ paddingHorizontal: isTV ? 0 : gutter }} {...swipe.panHandlers}>
      <Animated.View style={{ opacity: fade }} onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
        <Art uri={poster.cover || poster.image} seed={poster.id} radius={isTV ? 0 : radius.hero} style={{ height, justifyContent: 'flex-end' }}>
          <HeroSlide poster={poster} preferredFocus={preferredFocus} />
        </Art>
      </Animated.View>
      {count > 1 ? (
        <View accessibilityRole="tablist" style={{ position: 'absolute', bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          {items.map((p, i) => (
            <Focusable
              key={`${p.type}-${p.id}`}
              onPress={() => go(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === index }}
              accessibilityLabel={`اسلاید ${faNum(i + 1)}: ${p.title}`}
              ring={false}
              style={{ paddingVertical: 8, paddingHorizontal: 2 }}
            >
              <View style={{ width: i === index ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: i === index ? colors.accent : 'rgba(255,255,255,0.35)' }} />
            </Focusable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
