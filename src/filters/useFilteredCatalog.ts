import { useEffect, useMemo, useState } from 'react';

import { flatten, useMovies, useSeries } from '@/api/hooks';
import type { ContentType } from '@/api/types';

import { activeCount, applyFilters, EMPTY_FILTERS, optionsFrom, type Filters } from './filters';

const MIN_RESULTS = 24;
const MAX_AUTO_PAGES = 15;

/**
 * Infinite list + client-side filters. The API has no filter parameters, so while filters are
 * active and few items match, more pages are fetched automatically (up to a cap).
 */
export function useFilteredCatalog(type: ContentType) {
  const q = type === 'movie' ? useMovies() : useSeries(); // eslint-disable-line react-hooks/rules-of-hooks
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const all = useMemo(() => flatten(q.data?.pages), [q.data]);
  const items = useMemo(() => applyFilters(all, filters), [all, filters]);
  const options = useMemo(() => optionsFrom(all), [all]);
  const pages = q.data?.pages.length ?? 0;
  const filtering = activeCount(filters) > 0;
  const searchingMore = filtering && items.length < MIN_RESULTS && !!q.hasNextPage && pages < MAX_AUTO_PAGES;

  useEffect(() => {
    if (searchingMore && !q.isFetchingNextPage && !q.isLoading) q.fetchNextPage();
  }, [searchingMore, q.isFetchingNextPage, q.isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    query: q,
    all,
    items,
    filters,
    setFilters,
    options,
    searchingMore: searchingMore || (filtering && q.isFetchingNextPage),
    loadMore: () => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage(),
  };
}
