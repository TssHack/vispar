import { useCallback, useState } from 'react';
import { View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

/**
 * A strip behind the status bar for pages that scroll under it (#91). The detail pages draw their
 * backdrop to the very top, so the strip stays hidden there; once the page scrolls past `after`
 * points, text would run under the clock and battery (seen on iPhone), and the strip fades in.
 */
export function useStatusScrim(after = 200) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState(false);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const past = e.nativeEvent.contentOffset.y > after;
      setShown((s) => (s === past ? s : past));
    },
    [after],
  );
  const view = insets.top ? (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.bg, opacity: shown ? 0.96 : 0 }}
    />
  ) : null;
  return { onScroll, view, shown };
}
