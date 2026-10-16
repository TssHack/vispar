import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Focusable } from '@/components/Focusable';
import { Icon } from '@/components/Icon';
import { LogoMark } from '@/components/Logo';
import { Text } from '@/components/Text';
import { useLayout } from '@/hooks/useLayout';
import { faNum, faVersion } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

import { releaseTarget, TARGET_LABEL } from './target';
import { useUpdates } from './UpdateProvider';
import { pickAsset } from './version';

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  return `${faNum((bytes / (1024 * 1024)).toFixed(1))} مگابایت`;
}

function formatDate(iso: string) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}

/** Release notes are Markdown; show them as readable plain text. */
function cleanNotes(md: string) {
  return md
    .replace(/\r/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .trim();
}

export function UpdateSheet() {
  const { sheetOpen, release, currentVersion, install, dismiss, skipThisVersion } = useUpdates();
  const { colors } = useTheme();
  const { isWide, isTV } = useLayout();
  const insets = useSafeAreaInsets();
  if (!release) return null;
  const notes = cleanNotes(release.body);
  const target = releaseTarget();
  const asset = target ? pickAsset(release, target, { tv: Platform.isTV }) : null;
  const centered = isWide || isTV;

  return (
    <Modal visible={sheetOpen} transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: centered ? 'center' : 'flex-end', alignItems: 'center' }}>
        <Pressable
          accessibilityLabel="بستن"
          onPress={dismiss}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(4,4,7,0.72)' }}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: centered ? 520 : '100%',
            maxHeight: '86%',
            backgroundColor: colors.surface,
            borderRadius: centered ? 28 : 0,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            borderColor: colors.line,
            padding: 20,
            paddingBottom: 20 + (centered ? 0 : insets.bottom),
            gap: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#08080C', alignItems: 'center', justifyContent: 'center' }}>
              <LogoMark size={40} onDark />
            </View>
            <View style={{ flex: 1 }}>
              <Text size={18} weight={800} accessibilityRole="header">
                نسخه‌ی جدید ویسپار آماده است
              </Text>
              <Text size={12} color="muted">
                {faVersion(release.tagName)} · نسخه‌ی فعلی {faVersion(currentVersion)}
                {release.publishedAt ? ` · ${formatDate(release.publishedAt)}` : ''}
              </Text>
            </View>
            <Focusable onPress={dismiss} accessibilityRole="button" accessibilityLabel="بستن" ringRadius={14}
              style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={18} />
            </Focusable>
          </View>

          {notes ? (
            <View style={{ borderRadius: 16, backgroundColor: colors.surface2, padding: 14, maxHeight: 260 }}>
              <Text size={13} weight={700} color="text2" style={{ marginBottom: 6 }}>
                تغییرات این نسخه
              </Text>
              <ScrollView>
                <Text size={14} color="text2" line={1.9}>
                  {notes}
                </Text>
              </ScrollView>
            </View>
          ) : null}

          <View style={{ gap: 10 }}>
            <Button
              label={asset ? `دانلود برای ${target ? TARGET_LABEL[target] : ''}${asset.size ? ` · ${formatSize(asset.size)}` : ''}` : 'مشاهده در گیت‌هاب'}
              icon="download"
              size="lg"
              onPress={install}
              hasTVPreferredFocus
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button label="بعداً" variant="surface" onPress={dismiss} style={{ flex: 1 }} />
              <Button label="رد شدن از این نسخه" variant="ghost" onPress={skipThisVersion} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Thin banner shown when an over-the-air update has been downloaded. */
export function OtaBanner() {
  const { otaReady, applyOta } = useUpdates();
  const { colors } = useTheme();
  if (!otaReady) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 96,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 18,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.lineStrong,
      }}
    >
      <Icon name="refresh" size={20} color="accentText" />
      <Text size={13} weight={600} style={{ flex: 1 }}>
        به‌روزرسانی دریافت شد. برای اعمال، برنامه دوباره باز می‌شود.
      </Text>
      <Button label="اعمال" onPress={applyOta} />
    </View>
  );
}
