import { router, type Href } from 'expo-router';
import { Linking, Platform, View } from 'react-native';

import { config, repoUrl } from '@/config';
import { useLayout } from '@/hooks/useLayout';
import { faNum, faVersion } from '@/lib/format';
import { detectIOS, openInstallGuide, promptInstall, useInstallKind } from '@/pwa/install';
import { useTheme } from '@/theme/ThemeProvider';
import { isDesktopApp } from '@/update/target';
import { useUpdates } from '@/update/UpdateProvider';

import { Focusable } from './Focusable';
import { Icon, type IconName } from './Icon';
import { Logo } from './Logo';
import { Text } from './Text';

type LinkItem = { label: string; icon?: IconName; onPress: () => void; hint?: string };

function Column({ title, items }: { title: string; items: LinkItem[] }) {
  return (
    <View style={{ minWidth: 160, flexGrow: 1, flexBasis: 160, gap: 10 }}>
      <Text size={13} weight={800} color="muted" accessibilityRole="header">
        {title}
      </Text>
      {items.map((it) => (
        <Focusable key={it.label} onPress={it.onPress} accessibilityRole="link" ringRadius={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
          {it.icon ? <Icon name={it.icon} size={16} color="text2" /> : null}
          <Text size={14} color="text2">
            {it.label}
          </Text>
          {it.hint ? (
            <Text size={11} color="muted">
              {it.hint}
            </Text>
          ) : null}
        </Focusable>
      ))}
    </View>
  );
}

/** Web footer: product links, ways to get the app on every platform, and the developer credit. */
export function Footer() {
  const { colors } = useTheme();
  const { gutter, isWide } = useLayout();
  const { currentVersion } = useUpdates();
  const installKind = useInstallKind();
  const open = (url: string) => () => void Linking.openURL(url);
  const go = (href: Href) => () => router.navigate(href);
  const releases = `${repoUrl}/releases/latest`;

  const getApp: LinkItem[] = [
    { label: 'اندروید', icon: 'download', onPress: open(releases), hint: 'APK' },
    { label: 'ویندوز', icon: 'desktop', onPress: open(releases), hint: 'exe' },
    { label: 'مک', icon: 'desktop', onPress: open(releases), hint: 'dmg' },
    { label: 'لینوکس', icon: 'desktop', onPress: open(releases), hint: 'AppImage' },
  ];
  if (Platform.OS === 'web' && !isDesktopApp) {
    if (detectIOS() || installKind === 'ios') getApp.push({ label: 'آیفون و آیپد', icon: 'plus', onPress: openInstallGuide, hint: 'صفحه‌ی اصلی' });
    else if (installKind === 'prompt') getApp.push({ label: 'نصب وب‌اپ', icon: 'plus', onPress: () => void promptInstall() });
  }

  return (
    <View style={{ width: '100%', maxWidth: 1440, alignSelf: 'center', marginTop: 72, paddingHorizontal: gutter }}>
      <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 36, flexDirection: 'row', flexWrap: 'wrap', gap: 36, justifyContent: 'space-between' }}>
        <View style={{ flexGrow: 2, flexBasis: isWide ? 320 : 260, gap: 12, maxWidth: 420 }}>
          <Logo size={32} />
          <Text size={13} color="text2" line={1.9}>
            ویسپار فیلم و سریال را روی گوشی، تبلت، تلویزیون و کامپیوتر برایتان می‌آورد؛ سریع، راست‌به‌چپ و بی‌دردسر.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            {[
              { icon: 'github' as IconName, label: 'گیت‌هاب', url: repoUrl },
              { icon: 'globe' as IconName, label: 'وب‌سایت توسعه‌دهنده', url: config.developer.website },
            ].map((s) => (
              <Focusable key={s.label} onPress={open(s.url)} accessibilityRole="link" accessibilityLabel={s.label} ringRadius={14} style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={s.icon} size={19} />
              </Focusable>
            ))}
          </View>
        </View>

        <Column
          title="کاوش"
          items={[
            { label: 'خانه', icon: 'home', onPress: go('/') },
            { label: 'فیلم‌ها', icon: 'film', onPress: go('/movies') },
            { label: 'سریال‌ها', icon: 'tv', onPress: go('/series') },
            { label: 'کتابخانه‌ی من', icon: 'library', onPress: go('/library') },
            { label: 'تنظیمات', icon: 'settings', onPress: go('/settings') },
          ]}
        />
        <Column title="دریافت برنامه" items={getApp} />
        <Column
          title="پروژه"
          items={[
            { label: 'کد منبع', icon: 'github', onPress: open(repoUrl) },
            { label: 'گزارش مشکل', icon: 'alert', onPress: open(`${repoUrl}/issues`) },
            { label: 'نسخه‌ها و تغییرات', icon: 'history', onPress: open(`${repoUrl}/releases`) },
            { label: 'توسعه‌دهنده', icon: 'globe', onPress: open(config.developer.website) },
          ]}
        />
      </View>

      <View style={{ marginTop: 32, paddingVertical: 20, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <Text size={12} color="muted">
          © {faNum(new Date().getFullYear())} ویسپار · طراحی و توسعه: {config.developer.name}
        </Text>
        <Text size={12} color="muted">
          نسخه {faVersion(currentVersion)}
        </Text>
      </View>
    </View>
  );
}
