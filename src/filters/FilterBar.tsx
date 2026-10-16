import { ScrollView, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { Focusable } from '@/components/Focusable';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { faNum } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

import { activeCount, SORT_LABELS, toggleIn, type FilterOptions, type Filters } from './filters';

type Props = {
  value: Filters;
  onChange: (f: Filters) => void;
  onOpen: () => void;
  options: FilterOptions;
  resultCount: number;
  searchingMore: boolean;
};

/** One row: "Filters" button, current sort, then quick genre chips. */
export function FilterBar({ value, onChange, onOpen, options, resultCount, searchingMore }: Props) {
  const { colors } = useTheme();
  const n = activeCount(value);
  return (
    <View style={{ gap: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
        <Focusable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={n ? `فیلترها، ${faNum(n)} فعال` : 'فیلترها'}
          ringRadius={999}
          style={{
            height: 36,
            paddingHorizontal: 14,
            borderRadius: 999,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: n ? colors.accent : colors.surface,
            borderWidth: n ? 0 : 1,
            borderColor: colors.line,
          }}
        >
          <Icon name="filter" size={16} color={n ? colors.onAccent : colors.text} />
          <Text size={13} weight={700} color={n ? colors.onAccent : 'text'} line={1.4}>
            {n ? `فیلترها · ${faNum(n)}` : 'فیلترها'}
          </Text>
        </Focusable>
        <Focusable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`مرتب‌سازی: ${SORT_LABELS[value.sort]}`}
          ringRadius={999}
          style={{ height: 36, paddingHorizontal: 14, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}
        >
          <Icon name="sort" size={16} />
          <Text size={13} weight={600} color="text2" line={1.4}>
            {SORT_LABELS[value.sort]}
          </Text>
        </Focusable>
        <View style={{ width: 1, height: 22, backgroundColor: colors.line, marginHorizontal: 2 }} />
        {options.genres.slice(0, 10).map((g) => (
          <Chip key={g} label={g} selected={value.genres.includes(g)} onPress={() => onChange({ ...value, genres: toggleIn(value.genres, g) })} />
        ))}
      </ScrollView>
      {n ? (
        <Text size={12} color="muted">
          {faNum(resultCount)} نتیجه{searchingMore ? ' · در حال جستجو در صفحه‌های بیشتر…' : ''}
        </Text>
      ) : null}
    </View>
  );
}
