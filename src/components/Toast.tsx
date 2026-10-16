import { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type ToastMsg = { id: number; text: string; icon?: IconName };

let listener: ((t: ToastMsg) => void) | null = null;
let seq = 0;

/** Show a short message at the bottom of the screen. Safe to call from anywhere. */
export function toast(text: string, icon?: IconName) {
  listener?.({ id: ++seq, text, icon });
}

export function ToastHost() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    listener = (t) => setMsg(t);
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (!msg) return;
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: false }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: false }).start(() => setMsg(null));
    }, 2600);
    return () => clearTimeout(t);
  }, [msg, opacity]);

  if (!msg) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 96, alignItems: 'center', opacity }}
    >
      <View
        style={{
          maxWidth: 520,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 16,
          backgroundColor: colors.text,
        }}
      >
        {msg.icon ? <Icon name={msg.icon} size={18} color={colors.bg} /> : null}
        <Text size={13} weight={600} color={colors.bg}>
          {msg.text}
        </Text>
      </View>
    </Animated.View>
  );
}
