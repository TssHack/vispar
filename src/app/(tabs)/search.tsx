import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { useSearch } from '@/api/hooks';
import { CatalogGrid } from '@/components/CatalogGrid';
import { Chip } from '@/components/Chip';
import { Focusable } from '@/components/Focusable';
import { Icon } from '@/components/Icon';
import { faNum } from '@/lib/format';
import { clearSearches, forgetSearch, recentStore, rememberSearch } from '@/search/store';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

type Filter = 'all' | 'movie' | 'serie';

export default function Search() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q ?? '');
  const [filter, setFilter] = useState<Filter>('all');
  const search = useSearch(query);
  const recent = recentStore.use((l) => l);

  useEffect(() => {
    if (params.q !== undefined) setQuery(params.q);
  }, [params.q]);

  // Remember a search once it has sat still and found something, so half-typed words never land in the list.
  useEffect(() => {
    if (!(query.trim().length >= 2) || !search.data?.length) return;
    const t = setTimeout(() => rememberSearch(query), 1500);
    return () => clearTimeout(t);
  }, [query, search.data]);

  const all = search.data ?? [];
  const items = useMemo(() => (filter === 'all' ? all : all.filter((p) => p.type === filter)), [all, filter]);
  const counts = { all: all.length, movie: all.filter((p) => p.type === 'movie').length, serie: all.filter((p) => p.type === 'serie').length };
  const ready = query.trim().length >= 2;

  const header = (
    <View style={{ gap: 14 }}>
      <View
        style={{
          height: 52,
          borderRadius: 16,
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: query ? colors.accent : colors.line,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          gap: 10,
        }}
      >
        <Icon name="search" size={20} color="muted" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="نام فیلم یا سریال…"
          placeholderTextColor={colors.muted}
          accessibilityLabel="عبارت جستجو"
          autoFocus={!params.q}
          returnKeyType="search"
          onSubmitEditing={() => rememberSearch(query)}
          style={{ flex: 1, color: colors.text, fontFamily: 'Arad-Regular', fontSize: 15, textAlign: 'right', outlineStyle: 'none' } as object}
        />
        {query ? (
          <Focusable
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="پاک کردن"
            ringRadius={14}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="close" size={14} />
          </Focusable>
        ) : null}
      </View>
      {!ready && recent.length > 0 ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text size={13} weight={700} color="text2">جستجوهای اخیر</Text>
            <Focusable onPress={clearSearches} accessibilityRole="button" accessibilityLabel="پاک کردن همه جستجوهای اخیر" ringRadius={8} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text size={12} weight={600} color="muted">پاک کردن همه</Text>
            </Focusable>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {recent.map((q) => (
              <View key={q} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Chip label={q} onPress={() => setQuery(q)} />
                <Focusable
                  onPress={() => forgetSearch(q)}
                  accessibilityRole="button"
                  accessibilityLabel={`حذف «${q}» از جستجوهای اخیر`}
                  ringRadius={14}
                  style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icon name="close" size={12} color="muted" />
                </Focusable>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {ready && all.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="tablist">
          <Chip label={`همه · ${faNum(counts.all)}`} selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label={`فیلم · ${faNum(counts.movie)}`} selected={filter === 'movie'} onPress={() => setFilter('movie')} />
          <Chip label={`سریال · ${faNum(counts.serie)}`} selected={filter === 'serie'} onPress={() => setFilter('serie')} />
        </View>
      ) : null}
    </View>
  );

  return (
    <CatalogGrid
      title="جستجو"
      header={header}
      items={ready ? items : []}
      loading={ready && search.isLoading}
      error={search.error}
      onRefresh={() => search.refetch()}
      showType
      emptyTitle={ready ? `نتیجه‌ای برای «${query.trim()}» پیدا نشد` : 'دست‌کم دو حرف بنویسید'}
    />
  );
}
