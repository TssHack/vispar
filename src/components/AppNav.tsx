import { router, usePathname, type Href } from 'expo-router';
import { Platform, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';

import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/theme/ThemeProvider';

import { Focusable } from './Focusable';
import { Icon, type IconName } from './Icon';
import { Logo, LogoMark } from './Logo';
import { Text } from './Text';

type Item = { href: Href; path: string; label: string; icon: IconName };

/** Phone bottom bar (max five). Settings lives in the home header on phones. */
export const NAV: Item[] = [
  { href: '/', path: '/', label: 'خانه', icon: 'home' },
  { href: '/movies', path: '/movies', label: 'فیلم', icon: 'film' },
  { href: '/series', path: '/series', label: 'سریال', icon: 'tv' },
  { href: '/search', path: '/search', label: 'جستجو', icon: 'search' },
  { href: '/library', path: '/library', label: 'کتابخانه', icon: 'library' },
];
const SETTINGS: Item = { href: '/settings', path: '/settings', label: 'تنظیمات', icon: 'settings' };

function useActive() {
  const pathname = usePathname();
  return (item: Item) => (item.path === '/' ? pathname === '/' : pathname.startsWith(item.path));
}

/** Phone: bottom tab bar. */
export function BottomNav() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isActive = useActive();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        paddingHorizontal: 8,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 12),
        backgroundColor: colors.navBar,
        borderTopWidth: 1,
        borderTopColor: colors.line,
      }}
    >
      {NAV.map((item) => {
        const active = isActive(item);
        const c = active ? colors.accentText : colors.muted;
        return (
          <Focusable
            key={item.path}
            onPress={() => router.navigate(item.href)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            ringRadius={12}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 48 }}
          >
            <Icon name={item.icon} size={22} color={c} />
            <Text size={11} weight={active ? 700 : 600} color={c} line={1.3}>
              {item.label}
            </Text>
          </Focusable>
        );
      })}
    </View>
  );
}

/** Desktop web: top header with links and a search box. */
export function TopNav() {
  const { colors, name } = useTheme();
  const { gutter } = useLayout();
  const isActive = useActive();
  const [q, setQ] = useState('');
  const main = NAV.filter((i) => i.path !== '/search');
  return (
    <View
      style={
        [
          { width: '100%', borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: name === 'dark' ? 'rgba(8,8,12,0.72)' : 'rgba(247,245,240,0.78)', zIndex: 10 },
          Platform.OS === 'web' ? { backdropFilter: 'blur(18px) saturate(1.4)' } : null,
        ] as never
      }
    >
    <View
      style={{
        width: '100%',
        maxWidth: 1440,
        alignSelf: 'center',
        paddingHorizontal: gutter,
        paddingVertical: 14,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 24,
      }}
    >
      <Focusable onPress={() => router.navigate('/')} accessibilityRole="link" accessibilityLabel="خانه" ringRadius={12}>
        <Logo size={34} />
      </Focusable>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 6 }}>
        {main.map((item) => {
          const active = isActive(item);
          return (
            <Focusable
              key={item.path}
              onPress={() => router.navigate(item.href)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              ringRadius={12}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: active ? colors.surface2 : 'transparent' }}
            >
              <Text size={15} weight={active ? 700 : 600} color={active ? 'text' : 'text2'}>
                {item.label === 'فیلم' ? 'فیلم‌ها' : item.label === 'سریال' ? 'سریال‌ها' : item.label}
              </Text>
            </Focusable>
          );
        })}
      </View>
      <View style={{ flex: 1, minWidth: 220, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
        <View
          style={{
            flexBasis: 380,
            flexShrink: 1,
            height: 46,
            borderRadius: 14,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.line,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
            gap: 10,
          }}
        >
          <Icon name="search" size={18} color="muted" />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="جستجوی فیلم و سریال"
            placeholderTextColor={colors.muted}
            accessibilityLabel="جستجوی فیلم و سریال"
            returnKeyType="search"
            onSubmitEditing={() => router.navigate({ pathname: '/search', params: { q } })}
            style={{ flex: 1, color: colors.text, fontFamily: 'Arad-Regular', fontSize: 14, textAlign: 'right', outlineStyle: 'none' } as object}
          />
        </View>
        <Focusable
          onPress={() => router.navigate('/settings')}
          accessibilityRole="button"
          accessibilityLabel="تنظیمات"
          ringRadius={14}
          style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="settings" size={20} />
        </Focusable>
      </View>
    </View>
    </View>
  );
}

/** Android TV: vertical rail on the right (RTL start), moved through with the D-pad. */
export function SideRail() {
  const { colors } = useTheme();
  const isActive = useActive();
  return (
    <View
      accessibilityRole="tablist"
      style={{ width: 112, paddingVertical: 28, alignItems: 'center', gap: 10, backgroundColor: colors.bg, borderStartWidth: 1, borderColor: colors.line }}
    >
      <View style={{ marginBottom: 18 }}>
        <LogoMark size={44} onDark />
      </View>
      {[...NAV, SETTINGS].map((item) => {
        const active = isActive(item);
        return (
          <Focusable
            key={item.path}
            onPress={() => router.navigate(item.href)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            ringRadius={16}
            hasTVPreferredFocus={active}
            style={{
              width: 88,
              height: 68,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              backgroundColor: active ? colors.accentSoft : 'transparent',
            }}
          >
            <Icon name={item.icon} size={26} color={active ? colors.accent : colors.text2} />
            <Text size={12} weight={active ? 800 : 600} color={active ? 'accentText' : 'text2'} line={1.3}>
              {item.label}
            </Text>
          </Focusable>
        );
      })}
    </View>
  );
}
