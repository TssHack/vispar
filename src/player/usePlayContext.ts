import { useMemo } from 'react';

import { usePoster, useSeasons } from '@/api/hooks';
import type { ContentType, Episode, Poster, Source } from '@/api/types';
import type { PlayContext } from '@/external/actions';
import { findSaved, type EpisodeRef, type SavedPoster } from '@/library/store';
import { faNum } from '@/lib/format';

export type ResolvedPlay = {
  poster: Poster | SavedPoster | null;
  sources: Source[];
  episode: (EpisodeRef & { data: Episode }) | null;
  next: { ctx: PlayContext; sources: Source[]; label: string } | null;
  subtitle: string;
};

/** Works out what is playing (sources, episode, the next episode) from the route params. */
export function usePlayContext(type: ContentType | undefined, id: number, s?: number, e?: number): ResolvedPlay {
  const isEpisode = type === 'serie' && s !== undefined && e !== undefined;
  const seasons = useSeasons(isEpisode ? id : null);
  // Cached list item, library snapshot, or a fetch of the first pages (deep links / reloads).
  const detail = usePoster(type ?? 'movie', type ? id : 0);

  return useMemo(() => {
    const poster = type ? (detail.data ?? findSaved(type, id)) : null;
    if (!isEpisode) {
      return { poster, sources: poster?.sources ?? [], episode: null, next: null, subtitle: '' };
    }
    const list = seasons.data ?? [];
    const season = list[s!];
    const ep = season?.episodes[e!];
    const seasonTitle = (i: number) => (list[i]?.title ? faNum(list[i].title) : `فصل ${faNum(i + 1)}`);

    let next: ResolvedPlay['next'] = null;
    if (season) {
      const ni = e! + 1 < season.episodes.length ? { s: s!, e: e! + 1 } : list[s! + 1]?.episodes.length ? { s: s! + 1, e: 0 } : null;
      if (ni) {
        const nep = list[ni.s].episodes[ni.e];
        next = {
          ctx: { type: 'serie', id, title: poster?.title ?? '', seasonIndex: ni.s, episodeIndex: ni.e },
          sources: nep.sources,
          label: `${seasonTitle(ni.s)} · قسمت ${faNum(ni.e + 1)}${nep.title ? ` · ${faNum(nep.title)}` : ''}`,
        };
      }
    }

    return {
      poster,
      sources: ep?.sources ?? [],
      episode: ep ? { seasonIndex: s!, episodeIndex: e!, episodeId: ep.id || s! * 1000 + e!, title: ep.title, data: ep } : null,
      next,
      subtitle: ep ? `${seasonTitle(s!)} · قسمت ${faNum(e! + 1)}${ep.title ? ` · ${faNum(ep.title)}` : ''}` : '',
    };
  }, [type, id, s, e, isEpisode, seasons.data, detail.data]);
}
