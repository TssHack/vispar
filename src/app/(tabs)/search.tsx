import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { useSearch } from '@/api/hooks';
import { CatalogGrid } from '@/components/CatalogGrid';
import { Chip } from '@/components/Chip';
import { Focusable } from '@/components/Focusable';
import { Icon } from '@/components/Icon';
import { faNum } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

type Filter = 'all' | 'movie' | 'serie';

export default function Search() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q ?? '');
  const [filter, setFilter] = useState<Filter>('all');
  const search = useSearch(query);

  useEffect(() => {
    if (params.q !== undefined) setQuery(params.q);
  }, [params.q]);

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
