import Constants from 'expo-constants';

type Extra = {
  githubRepo?: string;
  developer?: { name?: string; nameEn?: string; website?: string };
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/**
 * API access has two modes:
 * - Proxy (recommended, and required on web): EXPO_PUBLIC_API_BASE points at the Worker in
 *   /proxy, which adds the key server-side and sends CORS headers. No key ships in the app.
 * - Direct: also set EXPO_PUBLIC_API_KEY and the base to the upstream API. The key is then
 *   embedded in the bundle, the same as the current Android app.
 */
export const config = {
  apiBase: (process.env.EXPO_PUBLIC_API_BASE ?? 'https://hostinnegar.com/api').replace(/\/+$/, ''),
  apiKey: process.env.EXPO_PUBLIC_API_KEY ?? '',
  timeoutMs: 30_000,
  githubRepo: extra.githubRepo ?? 'tsshack/vispar',
  developer: {
    name: extra.developer?.name ?? 'احسان فضلی',
    nameEn: extra.developer?.nameEn ?? 'Ehsan Fazli',
    website: extra.developer?.website ?? 'https://ehsanjs.ir',
  },
};

export const repoUrl = `https://github.com/${config.githubRepo}`;
