import Constants from 'expo-constants';

type Extra = {
  githubRepo?: string;
  developer?: { name?: string; nameEn?: string; website?: string };
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/** Public proxy (Vercel). It holds the upstream key and answers CORS, so no key ships in the app. */
export const DEFAULT_API_BASE = 'https://cdnd.ehsanfazli.ir/api';

/**
 * API access has two modes:
 * - Proxy (recommended, and required on web): EXPO_PUBLIC_API_BASE points at the Worker in
 *   /proxy, which adds the key server-side and sends CORS headers. No key ships in the app.
 * - Direct: also set EXPO_PUBLIC_API_KEY and the base to the upstream API. The key is then
 *   embedded in the bundle, the same as the current Android app.
 */
/**
 * HTTPS relay for plain-HTTP media on the web (see media-relay in the backend repo). Empty means
 * "none": the web player then explains that browsers block HTTP media. `?mediaBase=` can point at a
 * relay on localhost for testing; any other value in the URL is ignored.
 */
function resolveMediaBase(): string {
  const fromEnv = (process.env.EXPO_PUBLIC_MEDIA_BASE ?? '').replace(/\/+$/, '');
  if (typeof window === 'undefined' || !window.location) return fromEnv;
  const q = new URLSearchParams(window.location.search).get('mediaBase');
  return q && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(q) ? q.replace(/\/+$/, '') : fromEnv;
}

export const config = {
  mediaBase: resolveMediaBase(),
  apiBase: (process.env.EXPO_PUBLIC_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, ''),
  apiKey: process.env.EXPO_PUBLIC_API_KEY ?? '',
  timeoutMs: 30_000,
  githubRepo: extra.githubRepo ?? 'tsshack/vispar',
  developer: {
    name: extra.developer?.name ?? 'احسان فضلی',
    nameEn: extra.developer?.nameEn ?? 'Ehsan Fazli',
    website: extra.developer?.website ?? 'https://ehsanfazli.ir',
  },
};

export const repoUrl = `https://github.com/${config.githubRepo}`;
