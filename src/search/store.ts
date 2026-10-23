import { createPersistedStore } from '@/lib/persist';
import { addRecent, EMPTY_RECENT, migrateRecent, removeRecent } from '@/lib/recentSearches';

export const recentStore = createPersistedStore<readonly string[]>('vispar.recent', EMPTY_RECENT, migrateRecent);

export const rememberSearch = (q: string) => recentStore.set((l) => addRecent(l, q));
export const forgetSearch = (q: string) => recentStore.set((l) => removeRecent(l, q));
export const clearSearches = () => recentStore.set(EMPTY_RECENT);
