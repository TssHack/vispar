import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { setDigitStyle } from '@/lib/format';
import { settingsStore } from '@/settings/store';

import { accents, palettes, withAccent, type Palette, type ThemeName, type ThemePreference } from './tokens';

const STORAGE_KEY = 'vispar.theme';

type ThemeContextValue = {
  /** What the user picked in settings. Defaults to following the system. */
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  /** The theme actually in use after resolving "system". */
  name: ThemeName;
  colors: Palette;
  ready: boolean;
  /** Changes when the digit style changes, so memoized text re-renders. */
  digits: string;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function resolveTheme(preference: ThemePreference, system: string | null | undefined): ThemeName {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setPref(v);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const accentName = settingsStore.use((st) => st.accent);
  const digits = settingsStore.use((st) => st.digits);
  setDigitStyle(digits);

  const name = resolveTheme(preference, system);
  const colors = useMemo(() => withAccent(palettes[name], name, accents[accentName] ?? accents.amber), [name, accentName]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);

  const value = useMemo(
    () => ({ preference, setPreference, name, colors, ready, digits }),
    [preference, setPreference, name, colors, ready, digits],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
