import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { usePhase, type NetStatus } from '@/net/connectivity';
import { useSetting } from '@/settings/store';
import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

const native = Platform.OS !== 'web';
const AnimatedPath = Animated.createAnimatedComponent(Path);
const V_LENGTH = 106;

const ERR: Record<'offline' | 'server', { title: string; body: string; tips: string[] }> = {
  offline: {
    title: 'اینترنت وصل نیست',
    body: 'اتصال دستگاهتان را بررسی کنید. تا وصل شدن، خودکار دوباره تلاش می‌کنیم.',
    tips: ['Wi‑Fi یا داده‌ی همراه را روشن کنید', 'اگر VPN دارید، قطع و وصلش کنید'],
  },
  server: {
    title: 'سرور در دسترس نیست',
    body: 'اینترنت وصل است اما به سرور محتوا نرسیدیم. کمی بعد دوباره امتحان کنید.',
    tips: ['چند ثانیه صبر و دوباره تلاش کنید', 'کتابخانه‌ی شما بدون اینترنت هم باز می‌شود'],
  },
};

/** Soft amber glow painted with an SVG radial gradient (no blur filter needed, so it is cheap on TV). */
function Glow({ size, color, opacity }: { size: number; color: string; opacity: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" pointerEvents="none">
      <Defs>
        <RadialGradient id="glow" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx="50" cy="50" r="50" fill="url(#glow)" />
    </Svg>
  );
}

function StepRow({ label, state }: { label: string; state: 'wait' | 'run' | 'done' }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: state === 'wait' ? 0.4 : 1 }}>
      <View style={{ width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: state === 'done' ? colors.accent : 'transparent', borderWidth: state === 'done' ? 0 : 2, borderColor: state === 'run' ? colors.accent : colors.lineStrong }}>
        {state === 'done' ? <Icon name="check" size={12} color={colors.onAccent} strokeWidth={3} /> : null}
      </View>
      <Text size={13} weight={state === 'run' ? 700 : 500} color={state === 'wait' ? 'muted' : 'text2'}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Splash with the connection test: the V strokes itself in, the play mark pops, the name rises
 * and two steps (internet, server) tick off. On failure it becomes an offline / server-down
 * page with Retry and "continue offline" (library and history still work).
 */
export function BootScreen({ status, onRetry, onContinue }: { status: Exclude<NetStatus, 'online'>; onRetry: () => void; onContinue: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useSetting('reduceMotion');
  const phase = usePhase();
  const failed = status !== 'checking';

  const draw = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const rise = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) return;
    Animated.sequence([
      Animated.timing(draw, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: native }),
      Animated.timing(rise, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
    ]).start();
    const loops = [
      Animated.loop(Animated.sequence([Animated.timing(drift, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }), Animated.timing(drift, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: native })])),
      Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: native })),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [draw, pop, rise, drift, sweep, reduce]);

  const dash = draw.interpolate({ inputRange: [0, 1], outputRange: [V_LENGTH, 0] });
  const gx = drift.interpolate({ inputRange: [0, 1], outputRange: [-40, 40] });
  const gy = drift.interpolate({ inputRange: [0, 1], outputRange: [20, -20] });
  const tint = failed ? colors.danger : '#F2B544';
  const risen = { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] };
  const err = failed ? ERR[status as 'offline' | 'server'] : null;

  const stepState = (step: 'internet' | 'server'): 'wait' | 'run' | 'done' => {
    if (step === 'internet') return phase === 'internet' ? 'run' : 'done';
    return phase === 'internet' ? 'wait' : phase === 'server' ? 'run' : 'done';
  };

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: insets.top, paddingBottom: insets.bottom, overflow: 'hidden' }}
    >
      {/* Ambient light */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', transform: [{ translateX: gx }, { translateY: gy }] }]}>
        <View style={{ position: 'absolute', top: '8%', right: '-18%' }}>
          <Glow size={560} color={tint} opacity={0.22} />
        </View>
        <View style={{ position: 'absolute', bottom: '-12%', left: '-22%' }}>
          <Glow size={520} color={failed ? '#FF6B6B' : '#DB8520'} opacity={0.16} />
        </View>
        <Glow size={380} color={tint} opacity={0.2} />
      </Animated.View>

      {/* Mark */}
      <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
        {failed ? (
          <Animated.View style={{ opacity: rise }}>
            <Icon name="wifiOff" size={96} color="danger" strokeWidth={1.5} />
          </Animated.View>
        ) : (
          <>
            <Svg width={150} height={150} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
              <Defs>
                <RadialGradient id="vg" cx="50" cy="50" r="60" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor="#FFE0A0" />
                  <Stop offset="0.55" stopColor="#F2B544" />
                  <Stop offset="1" stopColor="#DB8520" />
                </RadialGradient>
              </Defs>
              <AnimatedPath d="M24 27 L50 73 L76 27" fill="none" stroke="url(#vg)" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={V_LENGTH} strokeDashoffset={dash} />
            </Svg>
            <Animated.View style={{ position: 'absolute', opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }] }}>
              <Svg width={150} height={150} viewBox="0 0 100 100">
                <Path d="M43.5 31 L43.5 47 L57 39 Z" fill="#F7F3EA" stroke="#F7F3EA" strokeWidth={3.2} strokeLinejoin="round" />
              </Svg>
            </Animated.View>
          </>
        )}
      </View>

      <Animated.View style={[{ alignItems: 'center', gap: 8, maxWidth: 440, marginTop: 6 }, risen]}>
        {failed && err ? (
          <>
            <Text size={24} weight={800} align="center" accessibilityRole="header">
              {err.title}
            </Text>
            <Text size={14} color="text2" align="center">
              {err.body}
            </Text>
            <View style={{ gap: 6, marginTop: 10, alignSelf: 'stretch', padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
              {err.tips.map((t) => (
                <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="info" size={14} color="muted" />
                  <Text size={12} color="text2" style={{ flex: 1 }}>
                    {t}
                  </Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 20 }}>
              <Button label="تلاش دوباره" icon="refresh" size="lg" onPress={onRetry} hasTVPreferredFocus />
              <Button label="ادامه بدون اتصال" variant="surface" size="lg" onPress={onContinue} />
            </View>
          </>
        ) : (
          <>
            <Text size={44} weight={800} align="center" line={1.2} accessibilityRole="header">
              ویسپار
            </Text>
            <Text size={14} color="text2" align="center">
              فیلم و سریال، هر جا و هر دستگاه
            </Text>
            <View style={{ gap: 10, marginTop: 28 }}>
              <StepRow label="بررسی اینترنت" state={stepState('internet')} />
              <StepRow label="اتصال به سرور محتوا" state={stepState('server')} />
            </View>
            <View style={{ marginTop: 22, width: 160, height: 3, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden' }}>
              <Animated.View style={{ width: 64, height: 3, borderRadius: 2, backgroundColor: colors.accent, transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-64, 160] }) }] }} />
            </View>
          </>
        )}
      </Animated.View>

      <Animated.View style={[{ position: 'absolute', bottom: insets.bottom + 20 }, { opacity: rise }]}>
        <Text size={11} color="muted" align="center">
          ehsanjs.ir
        </Text>
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
