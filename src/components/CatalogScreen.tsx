import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import type { ContentType } from '@/api/types';
import { FilterBar } from '@/filters/FilterBar';
import { FilterSheet } from '@/filters/FilterSheet';
import { activeCount, EMPTY_FILTERS } from '@/filters/filters';
import { useFilteredCatalog } from '@/filters/useFilteredCatalog';

import { Button } from './Button';
import { CatalogGrid } from './CatalogGrid';
import { EmptyState } from './States';

export function CatalogScreen({ type, title }: { type: ContentType; title: string }) {
  const c = useFilteredCatalog(type);
  const [open, setOpen] = useState(false);
  const { genre } = useLocalSearchParams<{ genre?: string }>();
  useEffect(() => {
    // Opened from a genre chip on the home screen.
    if (genre) c.setFilters({ ...EMPTY_FILTERS, genres: [genre] });
  }, [genre]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = c.query;
  const filtering = activeCount(c.filters) > 0;

  return (
    <>
      <CatalogGrid
        title={title}
        header={<FilterBar value={c.filters} onChange={c.setFilters} onOpen={() => setOpen(true)} options={c.options} resultCount={c.items.length} searchingMore={c.searchingMore} />}
        items={c.items}
        loading={q.isLoading || (filtering && c.items.length === 0 && c.searchingMore)}
        error={q.error}
        refreshing={q.isRefetching && !q.isFetchingNextPage}
        onRefresh={() => q.refetch()}
        loadingMore={q.isFetchingNextPage}
        onEndReached={c.loadMore}
        empty={
          filtering ? (
            <EmptyState title="موردی با این فیلترها پیدا نشد" body="فیلترها را کمتر کنید یا پاکشان کنید.">
              <Button label="پاک کردن فیلترها" variant="surface" onPress={() => c.setFilters({ ...EMPTY_FILTERS, sort: c.filters.sort })} />
            </EmptyState>
          ) : undefined
        }
      />
      <FilterSheet visible={open} onClose={() => setOpen(false)} value={c.filters} onApply={c.setFilters} options={c.options} type={type} items={c.all} />
    </>
  );
}
