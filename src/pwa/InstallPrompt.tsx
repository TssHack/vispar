import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Focusable } from '@/components/Focusable';
import { Icon } from '@/components/Icon';
import { LogoMark } from '@/components/Logo';
import { Text } from '@/components/Text';
import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/theme/ThemeProvider';

import { closeInstallGuide, detectIPad, pwaStore, promptInstall, useGuideOpen, useInstallKind, WEEK } from './install';

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text size={13} weight={800} color="accentText" line={1.2}>
          {n}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <Text size={15} weight={700}>
          {title}
        </Text>
        {children}
      </View>
    </View>
  );
}

/** Mock of the Safari toolbar with the Share button pulsing, so people know what to look for. */
function ToolbarMock({ top }: { top: boolean }) {
  const { colors } = useTheme();
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(bob, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);
  const dy = bob.interpolate({ inputRange: [0, 1], outputRange: top ? [0, -5] : [0, 5] });
  return (
    <View style={{ borderRadius: 16, backgroundColor: colors.surface2, padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
      <Icon name="back" size={18} color="muted" />
      <Icon name="chevronLeft" size={18} color="muted" />
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.accent }}>
          <Icon name="share" size={22} color="accentText" />
        </View>
        <Animated.View style={{ position: 'absolute', [top ? 'top' : 'bottom']: -20, transform: [{ translateY: dy }] }}>
          <Text size={18} color="accentText" line={1}>
            {top ? '▲' : '▼'}
          </Text>
        </Animated.View>
      </View>
      <Icon name="bookmark" size={18} color="muted" />
      <Icon name="layers" size={18} color="muted" />
    </View>
  );
}

function MenuRow({ icon, label, active }: { icon: 'plus' | 'bookmark' | 'link'; label: string; active?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        height: 46,
        borderRadius: 12,
        backgroundColor: active ? colors.accentSoft : colors.surface2,
        borderWidth: active ? 2 : 0,
        borderColor: colors.accent,
      }}
    >
      <Text size={13} weight={active ? 800 : 500} color={active ? 'text' : 'muted'}>
        {label}
      </Text>
      <Icon name={icon} size={18} color={active ? 'accentText' : 'muted'} />
    </View>
  );
}

/** Step-by-step "Add to Home Screen" guide for Safari on iPhone and iPad. */
function IosGuide({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { isWide } = useLayout();
  const insets = useSafeAreaInsets();
  const ipad = detectIPad();
  return (
    <Modal visible={visible} transparent animationType={isWide ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: isWide ? 'center' : 'flex-end', alignItems: 'center' }}>
        <Pressable accessibilityLabel="بستن" onPress={onClose} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(4,4,7,0.72)' }} />
        <View
          accessibilityViewIsModal
          style={{
            width: isWide ? 480 : '100%',
            maxHeight: '92%',
            backgroundColor: colors.surface,
            borderRadius: isWide ? 28 : 0,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            borderColor: colors.line,
            padding: 20,
            paddingBottom: 20 + (isWide ? 0 : insets.bottom),
            gap: 18,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#08080C', alignItems: 'center', justifyContent: 'center' }}>
              <LogoMark size={40} onDark />
            </View>
            <View style={{ flex: 1 }}>
              <Text size={18} weight={800} accessibilityRole="header">
                ویسپار را روی صفحه‌ی اصلی بگذارید
              </Text>
              <Text size={12} color="muted">
                مثل یک اپ واقعی، تمام‌صفحه و بدون نوار مرورگر
              </Text>
            </View>
            <Focusable onPress={onClose} accessibilityRole="button" accessibilityLabel="بستن" ringRadius={14} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={18} />
            </Focusable>
          </View>

          <Step n={1} title={`دکمه‌ی اشتراک‌گذاری ${ipad ? 'بالای' : 'پایین'} Safari را بزنید`}>
            <ToolbarMock top={ipad} />
          </Step>
          <Step n={2} title="در منو، «Add to Home Screen» را انتخاب کنید">
            <View style={{ gap: 6 }}>
              <MenuRow icon="bookmark" label="Add Bookmark" />
              <MenuRow icon="plus" label="Add to Home Screen" active />
            </View>
          </Step>
          <Step n={3} title="در بالای صفحه «Add» را بزنید">
            <Text size={12} color="muted">
              بعد از آن آیکن ویسپار کنار بقیه‌ی اپ‌هایتان قرار می‌گیرد.
            </Text>
          </Step>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="متوجه شدم" size="lg" onPress={onClose} style={{ flex: 1 }} hasTVPreferredFocus />
            <Button
              label="دیگر نشان نده"
              variant="ghost"
              size="lg"
              onPress={() => {
                pwaStore.set((s) => ({ ...s, neverAsk: true }));
                onClose();
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Android / desktop Chromium: small banner that triggers the native install prompt. */
function InstallBanner({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="alert"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: insets.bottom + 92,
        alignSelf: 'center',
        maxWidth: 520,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.lineStrong,
      }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#08080C', alignItems: 'center', justifyContent: 'center' }}>
        <LogoMark size={34} onDark />
      </View>
      <View style={{ flex: 1 }}>
        <Text size={14} weight={800}>
          نصب ویسپار
        </Text>
        <Text size={12} color="muted">
          دسترسی سریع‌تر و تمام‌صفحه
        </Text>
      </View>
      <Button
        label="نصب"
        onPress={() => {
          void promptInstall();
          onClose();
        }}
      />
      <Focusable onPress={onClose} accessibilityRole="button" accessibilityLabel="بستن" ringRadius={12} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="close" size={16} color="muted" />
      </Focusable>
    </View>
  );
}

/**
 * Mount once near the root. After a short delay it offers the right install flow for the browser:
 * the iOS how-to sheet on Safari, or the native prompt on Chromium. Respects "don't show again"
 * and waits a week after a dismissal.
 */
export function InstallPrompt() {
  const kind = useInstallKind();
  const { isTV } = useLayout();
  const guideRequested = useGuideOpen();
  const [auto, setAuto] = useState(false);
  const [bannerOff, setBannerOff] = useState(false);
  const prefs = pwaStore.use((s) => s);

  useEffect(() => {
    if (Platform.OS !== 'web' || isTV || kind === 'none') return;
    const t = setTimeout(() => setAuto(true), 7000);
    return () => clearTimeout(t);
  }, [kind, isTV]);

  if (Platform.OS !== 'web' || isTV || kind === 'none') return null;

  const allowed = !prefs.neverAsk && Date.now() - prefs.dismissedAt > WEEK;
  const dismiss = () => {
    pwaStore.set((s) => ({ ...s, dismissedAt: Date.now() }));
    closeInstallGuide();
    setAuto(false);
    setBannerOff(true);
  };

  if (kind === 'ios') return <IosGuide visible={guideRequested || (auto && allowed)} onClose={dismiss} />;
  if (kind === 'prompt' && auto && allowed && !bannerOff) return <InstallBanner onClose={dismiss} />;
  return null;
}
