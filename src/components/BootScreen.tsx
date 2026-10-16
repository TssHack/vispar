import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { NetStatus } from '@/net/connectivity';
import { useSetting } from '@/settings/store';
import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { Icon } from './Icon';
import { LogoMark } from './Logo';
import { Text } from './Text';

const native = Platform.OS !== 'web';

const COPY: Record<Exclude<NetStatus, 'online'>, { title: string; body: string }> = {
  checking: { title: 'ویسپار', body: 'در حال بررسی اتصال…' },
  offline: { title: 'اینترنت وصل نیست', body: 'اتصال دستگاهتان را بررسی کنید. تا وصل شدن، خودکار دوباره تلاش می‌کنیم.' },
  server: { title: 'سرور در دسترس نیست', body: 'اینترنت وصل است اما به سرور محتوا نرسیدیم. کمی بعد دوباره امتحان کنید.' },
};

/**
 * Splash with the connection test. It shows the animated mark while probing and turns into an
 * offline / server-down page with Retry and "continue offline" (library and history still work).
 */
export function BootScreen({ status, onRetry, onContinue }: { status: Exclude<NetStatus, 'online'>; onRetry: () => void; onContinue: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useSetting('reduceMotion');
  const pulse = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const failed = status !== 'checking';
  const copy = COPY[status];

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: reduce ? 0 : 700, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [enter, reduce]);

  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduce]);

  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.25] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.12] });
  const markScale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={{
            position: 'absolute',
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: failed ? colors.danger : colors.accent,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          }}
        />
        <Animated.View style={{ opacity: enter, transform: [{ scale: markScale }] }}>
          {failed ? <Icon name="wifiOff" size={84} color="danger" strokeWidth={1.6} /> : <LogoMark size={104} onDark />}
        </Animated.View>
      </View>

      <Animated.View style={{ opacity: enter, alignItems: 'center', gap: 10, maxWidth: 420, marginTop: 8 }}>
        <Text size={failed ? 22 : 30} weight={800} align="center" accessibilityRole="header">
          {copy.title}
        </Text>
        <Text size={14} color="text2" align="center">
          {copy.body}
        </Text>
        {failed ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 22 }}>
            <Button label="تلاش دوباره" icon="refresh" size="lg" onPress={onRetry} hasTVPreferredFocus />
            <Button label="ادامه بدون اتصال" variant="surface" size="lg" onPress={onContinue} />
          </View>
        ) : (
          <View style={{ marginTop: 18, width: 140, height: 3, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden' }}>
            <Animated.View
              style={{
                width: 56,
                height: 3,
                borderRadius: 2,
                backgroundColor: colors.accent,
                transform: [{ translateX: pulse.interpolate({ inputRange: [0, 1], outputRange: [-56, 140] }) }],
              }}
            />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

/** Slim strip shown over the app when the connection drops after launch. */
export function OfflineBanner({ status, onRetry }: { status: NetStatus; onRetry: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  if (status === 'online' || status === 'checking') return null;
  return (
    <View
      accessibilityRole="alert"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 6, paddingBottom: 8, paddingHorizontal: 16, backgroundColor: colors.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
    >
      <Icon name="wifiOff" size={16} color="#fff" />
      <Text size={12} weight={700} color="#fff">
        {status === 'offline' ? 'اینترنت قطع است' : 'سرور در دسترس نیست'}
      </Text>
      <Text size={12} weight={800} color="#fff" onPress={onRetry} accessibilityRole="button" style={{ textDecorationLine: 'underline' }}>
        تلاش دوباره
      </Text>
    </View>
  );
}
