export type ThemeName = 'dark' | 'light';
export type ThemePreference = 'system' | ThemeName;

export type Palette = {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  text2: string;
  muted: string;
  line: string;
  lineStrong: string;
  accent: string;
  onAccent: string;
  /** Accent used for text and icons; darker in light mode to keep 4.5:1 contrast. */
  accentText: string;
  accentSoft: string;
  imdb: string;
  onImdb: string;
  navBar: string;
  chipActiveBg: string;
  chipActiveText: string;
  danger: string;
};

export const palettes: Record<ThemeName, Palette> = {
  dark: {
    bg: '#08080C',
    surface: '#111118',
    surface2: '#1A1A24',
    text: '#F4F1EA',
    text2: '#C9C5D3',
    muted: '#8E8A9E',
    line: 'rgba(255,255,255,0.08)',
    lineStrong: 'rgba(255,255,255,0.16)',
    accent: '#F2B544',
    onAccent: '#140E04',
    accentText: '#F2B544',
    accentSoft: 'rgba(242,181,68,0.16)',
    imdb: '#F5C518',
    onImdb: '#000000',
    navBar: 'rgba(10,10,15,0.94)',
    chipActiveBg: '#F4F1EA',
    chipActiveText: '#08080C',
    danger: '#FF6B6B',
  },
  light: {
    bg: '#F7F5F0',
    surface: '#FFFFFF',
    surface2: '#EDEAE3',
    text: '#16141C',
    text2: '#4A4656',
    muted: '#6B6778',
    line: 'rgba(22,20,28,0.08)',
    lineStrong: 'rgba(22,20,28,0.16)',
    accent: '#F2B544',
    onAccent: '#140E04',
    accentText: '#9A6400',
    accentSoft: 'rgba(242,181,68,0.22)',
    imdb: '#F5C518',
    onImdb: '#000000',
    navBar: 'rgba(255,255,255,0.94)',
    chipActiveBg: '#16141C',
    chipActiveText: '#F7F5F0',
    danger: '#C62828',
  },
};

export type AccentSpec = {
  label: string;
  accent: string;
  onAccent: string;
  /** Text/icon accent on dark and light backgrounds (light needs a darker shade for contrast). */
  textDark: string;
  textLight: string;
  soft: string;
};

/** Accent colours the user can pick in settings. The logo itself always stays amber. */
export const accents = {
  amber: { label: 'کهربایی', accent: '#F2B544', onAccent: '#140E04', textDark: '#F2B544', textLight: '#9A6400', soft: 'rgba(242,181,68,0.18)' },
  coral: { label: 'مرجانی', accent: '#FF7A59', onAccent: '#1A0905', textDark: '#FF8F72', textLight: '#B23E1C', soft: 'rgba(255,122,89,0.18)' },
  teal: { label: 'فیروزه‌ای', accent: '#3FC9BE', onAccent: '#021614', textDark: '#5ED6CC', textLight: '#00756C', soft: 'rgba(63,201,190,0.18)' },
  violet: { label: 'بنفش', accent: '#A78BFA', onAccent: '#120A24', textDark: '#B8A1FB', textLight: '#6239D6', soft: 'rgba(167,139,250,0.2)' },
  rose: { label: 'صورتی', accent: '#F472B6', onAccent: '#22061A', textDark: '#F78CC4', textLight: '#AE2169', soft: 'rgba(244,114,182,0.18)' },
} satisfies Record<string, AccentSpec>;

export function withAccent(base: Palette, theme: ThemeName, spec: AccentSpec): Palette {
  return {
    ...base,
    accent: spec.accent,
    onAccent: spec.onAccent,
    accentText: theme === 'dark' ? spec.textDark : spec.textLight,
    accentSoft: spec.soft,
  };
}

/** Imagery (hero, posters) always sits on a dark scrim regardless of theme. */
export const cinema = {
  scrim: '#08080C',
  onImage: '#F4F1EA',
  onImage2: '#D9D5E0',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { tag: 9, poster: 14, button: 16, card: 18, hero: 26, pill: 999 } as const;

export const type = {
  display: { size: 34, weight: 800 as const, line: 1.15 },
  title: { size: 24, weight: 800 as const, line: 1.3 },
  section: { size: 18, weight: 800 as const, line: 1.4 },
  body: { size: 14, weight: 400 as const, line: 1.9 },
  label: { size: 13, weight: 600 as const, line: 1.5 },
  caption: { size: 12, weight: 400 as const, line: 1.5 },
};

/** Placeholder art when a poster/cover URL is missing or fails, picked deterministically by id. */
export const posterTints: [string, string][] = [
  ['#5B3A29', '#0B0A0F'],
  ['#1F3A4A', '#08090D'],
  ['#4A2340', '#0B080D'],
  ['#2E4030', '#08090A'],
  ['#3B3352', '#08080C'],
  ['#5A2A22', '#08080C'],
];
