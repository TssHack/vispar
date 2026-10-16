import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ContentType, Poster } from '@/api/types';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Focusable } from '@/components/Focusable';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { useLayout } from '@/hooks/useLayout';
import { faNum } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

import { activeCount, applyFilters, EMPTY_FILTERS, SORT_LABELS, toggleIn, type FilterOptions, type Filters, type SortKey } from './filters';

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text size={14} weight={800} accessibilityRole="header">
        {title}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}

type Props = {
  visible: boolean;
  onClose: () => void;
  value: Filters;
  onApply: (f: Filters) => void;
  options: FilterOptions;
  type: ContentType;
  /** Everything loaded so far, to preview the result count. */
  items: Poster[];
};

export function FilterSheet({ visible, onClose, value, onApply, options, type, items }: Props) {
  const { colors } = useTheme();
  const { isWide, isTV } = useLayout();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Filters>(value);
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const count = applyFilters(items, draft).length;
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const side = isWide || isTV;

  return (
    <Modal visible={visible} transparent animationType={side ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: side ? 'flex-start' : undefined, alignItems: side ? 'stretch' : 'flex-end' }}>
        <Pressable accessibilityLabel="بستن" onPress={onClose} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(4,4,7,0.7)' }} />
        <View
          accessibilityViewIsModal
          style={{
            width: side ? 440 : '100%',
            maxHeight: side ? '100%' : '90%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: side ? 0 : 28,
            borderTopRightRadius: side ? 0 : 28,
            paddingTop: side ? insets.top + 20 : 12,
          }}
        >
          {!side ? <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, marginBottom: 8 }} /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 }}>
            <Text size={20} weight={800} style={{ flex: 1 }} accessibilityRole="header">
              فیلتر و مرتب‌سازی
            </Text>
            <Focusable onPress={onClose} accessibilityRole="button" accessibilityLabel="بستن" ringRadius={14} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={18} />
            </Focusable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, gap: 24 }}>
            <Group title="مرتب‌سازی">
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <Chip key={k} label={SORT_LABELS[k]} selected={draft.sort === k} onPress={() => set('sort', k)} />
              ))}
            </Group>

            {options.genres.length ? (
              <Group title="ژانر">
                {options.genres.map((g) => (
                  <Chip key={g} label={g} selected={draft.genres.includes(g)} onPress={() => set('genres', toggleIn(draft.genres, g))} />
                ))}
              </Group>
            ) : null}

            <Group title="حداقل امتیاز IMDb">
              {([0, 6, 7, 8, 9] as const).map((n) => (
                <Chip key={n} label={n ? `${faNum(n)}+` : 'همه'} selected={draft.minImdb === n} onPress={() => set('minImdb', n)} />
              ))}
            </Group>

            {options.decades.length ? (
              <Group title="دهه">
                {options.decades.map((d) => (
                  <Chip key={d} label={`دهه‌ی ${faNum(d)}`} selected={draft.decades.includes(d)} onPress={() => set('decades', toggleIn(draft.decades, d))} />
                ))}
              </Group>
            ) : null}

            {options.countries.length ? (
              <Group title="کشور">
                {options.countries.slice(0, 24).map((c) => (
                  <Chip key={c} label={c} selected={draft.countries.includes(c)} onPress={() => set('countries', toggleIn(draft.countries, c))} />
                ))}
              </Group>
            ) : null}

            {type === 'movie' ? (
              <Group title="کیفیت موجود">
                <Chip label="همه" selected={!draft.quality} onPress={() => set('quality', null)} />
                <Chip label="4K" selected={draft.quality === '2160'} onPress={() => set('quality', '2160')} />
                <Chip label="1080p+" selected={draft.quality === '1080'} onPress={() => set('quality', '1080')} />
                <Chip label="720p+" selected={draft.quality === '720'} onPress={() => set('quality', '720')} />
              </Group>
            ) : null}

            <Text size={12} color="muted">
              فیلترها روی مواردی اعمال می‌شوند که تا الان بارگذاری شده‌اند؛ با پیمایش، صفحه‌های بیشتری جستجو می‌شود.
            </Text>
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 16 + insets.bottom, borderTopWidth: 1, borderTopColor: colors.line }}>
            <Button
              label={`نمایش ${faNum(count)} نتیجه`}
              size="lg"
              style={{ flex: 1 }}
              onPress={() => {
                onApply(draft);
                onClose();
              }}
              hasTVPreferredFocus={isTV}
            />
            <Button label={activeCount(draft) ? `پاک کردن (${faNum(activeCount(draft))})` : 'پاک کردن'} variant="surface" size="lg" onPress={() => setDraft({ ...EMPTY_FILTERS, sort: draft.sort })} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
