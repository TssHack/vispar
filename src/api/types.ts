export type Genre = { id: number; title: string };
export type Country = { id: number; title: string; image: string };
export type Source = { id: number; quality: string; type: string; url: string };

export type ContentType = 'movie' | 'serie';

/** Movie, Series and search Poster share one shape; series simply have no sources. */
export type Poster = {
  id: number;
  type: ContentType;
  title: string;
  description: string;
  year: number;
  imdb: number;
  rating: number;
  /** null when the API sends null, "null" or "N/A". */
  duration: string | null;
  image: string;
  cover: string;
  genres: Genre[];
  country: Country[];
  sources: Source[];
};

export type Episode = {
  id: number;
  title: string;
  description: string;
  duration: string | null;
  image: string;
  sources: Source[];
};

export type Season = { id: number; title: string; episodes: Episode[] };

export type GithubRelease = {
  tagName: string;
  name: string;
  body: string;
  htmlUrl: string;
  publishedAt: string;
  prerelease: boolean;
  draft: boolean;
  /** Direct .apk download, when the release has one attached. */
  apkUrl: string | null;
  apkSize: number | null;
};
