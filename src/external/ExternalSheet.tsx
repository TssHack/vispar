import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Focusable } from '@/components/Focusable';
import { Icon, type IconName } from '@/components/Icon';
import { Text } from '@/components/Text';
import { useLayout } from '@/hooks/useLayout';
import { setSetting } from '@/settings/store';
import { useTheme } from '@/theme/ThemeProvider';

import type { ExternalApp } from './apps';
import { appIcon, appsFor, copyLink, detectInstalled, downloadPlaylist, downloadWithSystem, openInApp, openWithSystemPlayer, shareLink } from './launch';
import { setSheetListener, type SheetRequest } from './sheet';

function Row({ icon, image, title, subtitle, onPress, badge }: { icon?: IconName; image?: string | null; title: string; subtitle?: string; onPress: () => void; badge?: string }) {
  const { colors } = useTheme();
  return (
    <Focusable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}، ${subtitle}` : title}
      ringRadius={14}
      style={{ minHeight: 56, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface2 }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
        {image ? <Image source={{ uri: image }} style={{ width: 36, height: 36 }} /> : <Icon name={icon ?? 'play'} size={18} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text size={14} weight={700}>
          {title}
        </Text>
        {subtitle ? (
          <Text size={12} color="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {badge ? (
        <View style={{ paddingHorizontal: 8, borderRadius: 999, backgroundColor: colors.accentSoft }}>
          <Text size={11} weight={700} color="accentText" line={1.8}>
            {badge}
          </Text>
        </View>
      ) : null}
    </Focusable>
  );
}

/** Global "play with…" / "download with…" chooser. Mounted once in the root layout. */
export function ExternalSheetHost() {
  const { colors } = useTheme();
  const { isWide, isTV } = useLayout();
  const insets = useSafeAreaInsets();
  const [req, setReq] = useState<SheetRequest | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [icons, setIcons] = useState<Record<string, string | null>>({});
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    setSheetListener((r) => {
      setReq(r);
      setRemember(false);
    });
    return () => setSheetListener(null);
  }, []);

  useEffect(() => {
    if (!req) return;
    detectInstalled().then(async (set) => {
      setInstalled(set);
      const apps = appsFor(req.kind, { tv: isTV }).filter((a) => set.has(a.id));
      const entries = await Promise.all(apps.map(async (a) => [a.id, await appIcon(a)] as const));
      setIcons(Object.fromEntries(entries));
    });
  }, [req, isTV]);

  if (!req) return null;
  const close = () => setReq(null);
  const isPlayer = req.kind === 'player';
  const apps = appsFor(req.kind, { tv: isTV });
  // Installed first; on Android only installed apps are listed unless none are.
  const installedApps = apps.filter((a) => installed.has(a.id));
  const shown: ExternalApp[] = Platform.OS === 'android' && installedApps.length ? [...installedApps, ...apps.filter((a) => !installed.has(a.id))] : apps;

  const pick = (fn: () => void, mode?: string) => {
    if (remember && mode) setSetting(isPlayer ? 'playerMode' : 'downloaderMode', mode);
    close();
    fn();
  };

  const centered = isWide || isTV;
  return (
    <Modal visible transparent animationType={centered ? 'fade' : 'slide'} onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: centered ? 'center' : 'flex-end', alignItems: 'center' }}>
        <Pressable accessibilityLabel="بستن" onPress={close} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(4,4,7,0.72)' }} />
        <View
          accessibilityViewIsModal
          style={{
            width: centered ? 520 : '100%',
            maxHeight: '88%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderRadius: centered ? 28 : undefined,
            paddingTop: 12,
            paddingHorizontal: 16,
            paddingBottom: 16 + (centered ? 0 : insets.bottom),
            gap: 12,
          }}
        >
          {!centered ? <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong }} /> : null}
          <View>
            <Text size={18} weight={800} accessibilityRole="header">
              {isPlayer ? 'پخش با…' : 'دانلود با…'}
            </Text>
            <Text size={12} color="muted" numberOfLines={1}>
              {req.title}
            </Text>
          </View>
          <ScrollView contentContainerStyle={{ gap: 8 }}>
            {isPlayer && req.playInternal ? (
              <Row icon="play" title="پلیر ویسپار" subtitle="پخش داخل برنامه" onPress={() => pick(req.playInternal!, 'internal')} />
            ) : null}
            {shown.map((app) => (
              <Row
                key={app.id}
                image={icons[app.id]}
                icon={isPlayer ? 'play' : 'download'}
                title={app.name}
                badge={installed.has(app.id) ? 'نصب‌شده' : undefined}
                subtitle={Platform.OS === 'android' && !installed.has(app.id) ? 'نصب نیست؛ صفحه‌ی دانلودش باز می‌شود' : undefined}
                onPress={() => pick(() => openInApp(app, req.url, req.title), app.id)}
              />
            ))}
            {isPlayer ? (
              <Row
                icon="tv"
                title={Platform.OS === 'web' ? 'پلیر سیستم (VLC، PotPlayer، MPC)' : 'سایر برنامه‌ها'}
                subtitle={Platform.OS === 'web' ? 'فایل پلی‌لیست ‎.m3u دانلود می‌شود' : 'انتخاب از برنامه‌های نصب‌شده'}
                onPress={() => pick(() => (Platform.OS === 'web' ? downloadPlaylist(req.url, req.title) : openWithSystemPlayer(req.url, req.title)))}
              />
            ) : (
              <Row
                icon="globe"
                title={Platform.OS === 'web' ? 'دانلود با مرورگر' : 'مرورگر / مدیر دانلود سیستم'}
                subtitle={Platform.OS === 'web' ? 'IDM و FDM هم دانلود مرورگر را می‌گیرند' : undefined}
                onPress={() => pick(() => downloadWithSystem(req.url, req.title), 'system')}
              />
            )}
            {Platform.OS !== 'web' ? <Row icon="share" title="اشتراک‌گذاری لینک" subtitle="ارسال به هر برنامه‌ای" onPress={() => pick(() => shareLink(req.url, req.title))} /> : null}
            <Row icon="check" title="کپی لینک" subtitle={Platform.OS === 'web' ? 'برای JDownloader یا IDM' : undefined} onPress={() => pick(() => copyLink(req.url))} />
          </ScrollView>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
            <Text size={13} color="text2">
              انتخابم را به خاطر بسپار
            </Text>
            <Switch
              value={remember}
              onValueChange={setRemember}
              accessibilityLabel="انتخابم را به خاطر بسپار"
              trackColor={{ true: colors.accent, false: colors.surface2 }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
