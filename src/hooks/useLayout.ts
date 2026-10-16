import { Platform, useWindowDimensions } from 'react-native';

import { useSetting } from '@/settings/store';

/** On web, `?tv=1` previews the Android TV layout (for design review in a browser). */
const tvPreview =
  Platform.OS === 'web' && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tv') === '1';

export type Breakpoint = 'phone' | 'tablet' | 'desktop' | 'tv';

const DENSITY = { compact: 0.84, normal: 1, large: 1.2 } as const;

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const density = useSetting('density');
  const isTV = Platform.isTV || tvPreview;
  const isWeb = Platform.OS === 'web';
  const bp: Breakpoint = isTV ? 'tv' : width >= 900 ? 'desktop' : width >= 600 ? 'tablet' : 'phone';
  /** Desktop/large-tablet layout: top navigation, wider content. */
  const isWide = bp === 'desktop';
  const isTablet = bp === 'tablet';
  const gutter = isTV ? 48 : isWide ? Math.min(40, Math.max(20, width * 0.03)) : isTablet ? 24 : 16;
  const base = isTV ? 150 : isWide ? 172 : isTablet ? 140 : 118;
  const posterWidth = Math.round(base * DENSITY[density]);
  /** Width of wide "landscape" cards (continue watching, series rails). */
  const cardWidth = Math.round((isTV ? 300 : isWide ? 300 : isTablet ? 260 : 232) * DENSITY[density]);
  const maxContent = 1440;
  return { width, height, bp, isTV, isWeb, isWide, isTablet, gutter, posterWidth, cardWidth, maxContent, landscape: width > height };
}
