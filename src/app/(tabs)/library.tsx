import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fromSaved } from '@/api/hooks';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Focusable } from '@/components/Focusable';
import { Icon } from '@/components/Icon';
import { ContinueCard, resume } from '@/components/LandscapeCard';
import { openPoster, PosterCard } from '@/components/PosterCard';
import { EmptyState } from '@/components/States';
import { Text } from '@/components/Text';
import { Art } from '@/components/Art';
import { useLayout } from '@/hooks/useLayout';
import { clearFavorites, clearHistory, continueWatching, history, isFinished, removeProgress, useFavorites, useProgressMap, type Progress } from '@/library/store';
import { confirm } from '@/lib/confirm';
import { faClock, faNum } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

type Tab = 'list' | 'continue' | 'history';

function timeAgo(ts: number) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'همین الان';
  if (m < 60) return `${faNum(m)} دقیقه پیش`;
  const h = Math.round(m / 60);
  if (h < 24) return `${faNum(h)} ساعت پیش`;
  const d = Math.round(h / 24);
  return `${faNum(d)} روز پیش`;
}

function HistoryRow({ p }: { p: Progress }) {
  const { colors } = useTheme();
  const done = isFinished(p);
  const pct = p.duration ? Math.min(1, p.position / p.duration) : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Focusable onPress={() => (done ? openPoster(p.poster) : resume(p))} accessibilityRole="button" accessibilityLabel={p.poster.title} ringRadius={12} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Art uri={p.poster.cover || p.poster.image} seed={p.poster.id} radius={10} style={{ width: 112, height: 64 }}>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.25)', direction: 'ltr' }}>
            <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: colors.accent }} />
          </View>
        </Art>
        <View style={{ flex: 1 }}>
          <Text size={14} weight={700} numberOfLines={1}>
            {p.poster.title}
          </Text>
          <Text size={12} color="muted" numberOfLines={1}>
            {[p.episode ? `فصل ${faNum(p.episode.seasonIndex + 1)} · قسمت ${faNum(p.episode.episodeIndex + 1)}` : null, done ? 'تماشا شد' : `${faClock(p.position)} از ${faClock(p.duration)}`, timeAgo(p.updatedAt)].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </Focusable>
      <Focusable onPress={() => removeProgress(p.key)} accessibilityRole="button" accessibilityLabel={`حذف ${p.poster.title} از تاریخچه`} ringRadius={12} style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="close" size={16} color="muted" />
      </Focusable>
    </View>
  );
}

export default function Library() {
  const { colors } = useTheme();
  const { gutter, isTV, isWide, width, posterWidth, cardWidth, maxContent } = useLayout();
  const insets = useSafeAreaInsets();
  const favorites = useFavorites();
  const progress = useProgressMap();
  const [tab, setTab] = useState<Tab>('list');
  const cont = useMemo(() => continueWatching(progress), [progress]);
  const hist = useMemo(() => history(progress), [progress]);
  const phone = !isTV && !isWide;

  const usable = Math.min(width - (isTV ? 96 : 0), isWide ? maxContent : width) - gutter * 2;
  const gap = isTV ? 22 : isWide ? 18 : 10;
  const cols = (min: number) => Math.max(2, Math.floor((usable + gap) / (min + gap)));
  const posterCols = Math.max(3, cols(isWide || isTV ? posterWidth : posterWidth * 0.88));
  const posterCell = Math.floor((usable - gap * (posterCols - 1)) / posterCols);
  const cardCols = cols(cardWidth);
  const cardCell = Math.floor((usable - gap * (cardCols - 1)) / cardCols);

  const header = (
    <View style={{ gap: 14, paddingBottom: 16 }}>
      <Text size={isTV ? 30 : 26} weight={800} accessibilityRole="header">
        کتابخانه
      </Text>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Chip label={`لیست من · ${faNum(favorites.length)}`} selected={tab === 'list'} onPress={() => setTab('list')} />
        <Chip label={`ادامه‌ی تماشا · ${faNum(cont.length)}`} selected={tab === 'continue'} onPress={() => setTab('continue')} />
        <Chip label="تاریخچه" selected={tab === 'history'} onPress={() => setTab('history')} />
        <View style={{ flex: 1 }} />
        {tab === 'list' && favorites.length ? (
          <Button label="پاک کردن لیست" icon="trash" variant="ghost" onPress={async () => (await confirm('پاک کردن لیست من', 'همه‌ی موارد لیست حذف می‌شوند.', 'پاک کن')) && clearFavorites()} />
        ) : null}
        {tab === 'history' && hist.length ? (
          <Button label="پاک کردن تاریخچه" icon="trash" variant="ghost" onPress={async () => (await confirm('پاک کردن تاریخچه', 'تاریخچه و ادامه‌ی تماشا پاک می‌شوند.', 'پاک کن')) && clearHistory()} />
        ) : null}
      </View>
    </View>
  );

  const container = {
    paddingTop: phone ? insets.top + 14 : 14,
    paddingHorizontal: gutter,
    paddingBottom: 40,
    gap: gap + 8,
    width: '100%' as const,
    maxWidth: isWide ? maxContent : undefined,
    alignSelf: 'center' as const,
  };

  if (tab === 'list') {
    return (
      <FlatList
        key={`list-${posterCols}`}
        style={{ flex: 1, backgroundColor: colors.bg }}
        data={favorites}
        numColumns={posterCols}
        columnWrapperStyle={{ gap }}
        keyExtractor={(f) => `${f.poster.type}-${f.poster.id}`}
        contentContainerStyle={container}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState title="لیست شما خالی است" body="با دکمه‌ی نشانک روی هر فیلم یا سریال، آن را به این لیست اضافه کنید." />}
        renderItem={({ item, index }) => <PosterCard poster={fromSaved(item.poster)} width={posterCell} showType hasTVPreferredFocus={isTV && index === 0} />}
      />
    );
  }
  if (tab === 'continue') {
    return (
      <FlatList
        key={`cont-${cardCols}`}
        style={{ flex: 1, backgroundColor: colors.bg }}
        data={cont}
        numColumns={cardCols}
        columnWrapperStyle={cardCols > 1 ? { gap } : undefined}
        keyExtractor={(p) => p.key}
        contentContainerStyle={container}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState title="چیزی برای ادامه نیست" body="هر چه را نیمه‌کاره ببینید، اینجا می‌آید." />}
        renderItem={({ item }) => <ContinueCard item={item} width={cardCell} removable={!isTV} />}
      />
    );
  }
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      data={hist}
      keyExtractor={(p) => p.key}
      contentContainerStyle={{ ...container, gap: 12, maxWidth: 820 }}
      ListHeaderComponent={header}
      ListEmptyComponent={<EmptyState title="تاریخچه خالی است" />}
      renderItem={({ item }) => <HistoryRow p={item} />}
    />
  );
}
