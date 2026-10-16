import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Focusable } from '@/components/Focusable';
import { Icon, type IconName } from '@/components/Icon';
import { LogoMark } from '@/components/Logo';
import { Text } from '@/components/Text';
import { toast } from '@/components/Toast';
import { config, repoUrl } from '@/config';
import { appsFor, detectInstalled } from '@/external/launch';
import { useLayout } from '@/hooks/useLayout';
import { getPermission, notificationsSupported, notifyLocal, requestPermission } from '@/notifications';
import { checkNewContent } from '@/notifications/watcher';
import { detectStandalone, openInstallGuide, promptInstall, useInstallKind } from '@/pwa/install';
import { clearFavorites, clearHistory } from '@/library/store';
import { confirm } from '@/lib/confirm';
import { faNum, faVersion } from '@/lib/format';
import { setHomeSection, setSetting, settingsStore, type AccentName, type HomeSections } from '@/settings/store';
import { useTheme } from '@/theme/ThemeProvider';
import { accents, type ThemePreference } from '@/theme/tokens';
import { useUpdates } from '@/update/UpdateProvider';

const THEMES: { value: ThemePreference; label: string; swatch: [string, string] }[] = [
  { value: 'system', label: 'سیستم', swatch: ['#F7F5F0', '#08080C'] },
  { value: 'light', label: 'روشن', swatch: ['#F7F5F0', '#F7F5F0'] },
  { value: 'dark', label: 'تیره', swatch: ['#08080C', '#08080C'] },
];

const HOME_LABELS: Record<keyof HomeSections, string> = {
  continueWatching: 'ادامه‌ی تماشا',
  myList: 'لیست من',
  movies: 'تازه‌ترین فیلم‌ها',
  series: 'سریال‌های جدید',
  topRated: 'برترین‌ها از نظر IMDb',
  genres: 'ردیف ژانرها',
};

function Card({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={{ borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 16 }}>{children}</View>;
}

function Section({ title, icon, children }: { title: string; icon: IconName; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={16} color="text2" />
        <Text size={14} weight={700} color="text2" accessibilityRole="header">
          {title}
        </Text>
      </View>
      <Card>{children}</Card>
    </View>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View>
        <Text size={15} weight={700}>
          {label}
        </Text>
        {hint ? (
          <Text size={12} color="muted">
            {hint}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text size={14} weight={600}>
          {label}
        </Text>
        {hint ? (
          <Text size={12} color="muted">
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: colors.accent, false: colors.surface2 }} thumbColor="#FFFFFF" />
    </View>
  );
}

function LinkRow({ icon, title, subtitle, url }: { icon: IconName; title: string; subtitle: string; url: string }) {
  const { colors } = useTheme();
  return (
    <Focusable
      onPress={() => Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={`${title}، ${subtitle}`}
      ringRadius={14}
      style={{ minHeight: 52, borderRadius: 14, backgroundColor: colors.surface2, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}
    >
      <Icon name={icon} size={20} />
      <View style={{ flex: 1 }}>
        <Text size={14} weight={700}>
          {title}
        </Text>
        <Text size={12} color="muted" style={{ writingDirection: 'ltr', textAlign: 'right' }}>
          {subtitle}
        </Text>
      </View>
      <Icon name="chevronLeft" size={18} color="muted" />
    </Focusable>
  );
}

export default function Settings() {
  const { colors, preference, setPreference } = useTheme();
  const { gutter, isTV, isWide } = useLayout();
  const insets = useSafeAreaInsets();
  const s = settingsStore.use((x) => x);
  const up = useUpdates();
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  useEffect(() => {
    detectInstalled().then(setInstalled);
  }, []);
  const installKind = useInstallKind();
  const canNotify = notificationsSupported();
  const phone = !isTV && !isWide;
  const toggleNotify = async (on: boolean) => {
    if (!on) return setSetting('notifyNewContent', false);
    const perm = (await getPermission()) === 'granted' ? 'granted' : await requestPermission();
    if (perm !== 'granted') {
      toast('اجازه‌ی اعلان داده نشد. از تنظیمات دستگاه فعالش کنید.', 'alert');
      return;
    }
    setSetting('notifyNewContent', true);
    toast('اعلان‌ها فعال شد', 'bell');
    void checkNewContent(true);
  };
  const native = Platform.OS !== 'web';
  const players = appsFor('player', { tv: isTV });
  const downloaders = appsFor('downloader');
  const appLabel = (id: string, name: string) => (installed.has(id) ? `${name} ✓` : name);

  const statusText = (() => {
    switch (up.status) {
      case 'checking':
        return 'در حال بررسی…';
      case 'available':
        return `نسخه‌ی ${faVersion(up.release?.tagName ?? '')} آماده‌ی نصب است`;
      case 'upToDate':
        return 'آخرین نسخه نصب است';
      case 'error':
        return 'بررسی ناموفق بود. اینترنت را بررسی کنید.';
      default:
        return Platform.OS === 'web' && !up.supported ? 'نسخه‌ی وب همیشه به‌روز است' : 'به‌روزرسانی خودکار بررسی می‌شود';
    }
  })();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: phone ? insets.top + 14 : 14, paddingHorizontal: gutter, paddingBottom: 48, gap: 24, width: '100%', maxWidth: 760, alignSelf: isWide || isTV ? 'flex-start' : undefined }}
    >
      <Text size={isTV ? 30 : 26} weight={800} accessibilityRole="header">
        تنظیمات
      </Text>

      <Section title="ظاهر" icon="palette">
        <View style={{ gap: 10 }}>
          <View>
            <Text size={15} weight={700}>
              تم برنامه
            </Text>
            <Text size={12} color="muted">
              پیش‌فرض: هماهنگ با تنظیمات سیستم
            </Text>
          </View>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8 }}>
            {THEMES.map((t) => {
              const selected = preference === t.value;
              return (
                <Focusable
                  key={t.value}
                  onPress={() => setPreference(t.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`تم ${t.label}`}
                  ringRadius={16}
                  hasTVPreferredFocus={isTV && selected}
                  style={{ flex: 1, height: 92, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.surface2, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.accent : colors.line }}
                >
                  <View style={{ width: 44, height: 30, borderRadius: 8, overflow: 'hidden', flexDirection: 'row', borderWidth: 1, borderColor: colors.lineStrong }}>
                    <View style={{ flex: 1, backgroundColor: t.swatch[0] }} />
                    <View style={{ flex: 1, backgroundColor: t.swatch[1] }} />
                  </View>
                  <Text size={13} weight={selected ? 700 : 600} color={selected ? 'text' : 'text2'}>
                    {t.label}
                  </Text>
                </Focusable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Text size={15} weight={700}>
            رنگ اصلی
          </Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {(Object.keys(accents) as AccentName[]).map((k) => {
              const selected = s.accent === k;
              return (
                <Focusable
                  key={k}
                  onPress={() => setSetting('accent', k)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`رنگ ${accents[k].label}`}
                  ringRadius={24}
                  style={{ alignItems: 'center', gap: 6 }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: accents[k].accent, alignItems: 'center', justifyContent: 'center', borderWidth: selected ? 3 : 0, borderColor: colors.text }}>
                    {selected ? <Icon name="check" size={20} color={accents[k].onAccent} /> : null}
                  </View>
                  <Text size={11} weight={selected ? 700 : 500} color={selected ? 'text' : 'muted'}>
                    {accents[k].label}
                  </Text>
                </Focusable>
              );
            })}
          </View>
        </View>

        <Field label="اندازه‌ی پوسترها">
          <Chip label="کوچک" selected={s.density === 'compact'} onPress={() => setSetting('density', 'compact')} />
          <Chip label="معمولی" selected={s.density === 'normal'} onPress={() => setSetting('density', 'normal')} />
          <Chip label="بزرگ" selected={s.density === 'large'} onPress={() => setSetting('density', 'large')} />
        </Field>
        <Field label="ارقام">
          <Chip label="فارسی ۱۲۳" selected={s.digits === 'fa'} onPress={() => setSetting('digits', 'fa')} />
          <Chip label="انگلیسی 123" selected={s.digits === 'en'} onPress={() => setSetting('digits', 'en')} />
        </Field>
        <Toggle label="نمایش امتیاز روی پوسترها" value={s.showRatings} onChange={(v) => setSetting('showRatings', v)} />
        <Toggle label="جابه‌جایی خودکار اسلایدر خانه" value={s.heroAuto} onChange={(v) => setSetting('heroAuto', v)} />
        <Toggle label="کاهش حرکت و انیمیشن" hint="اسلایدر خانه خودکار جابه‌جا نمی‌شود" value={s.reduceMotion} onChange={(v) => setSetting('reduceMotion', v)} />
      </Section>

      <Section title="صفحه‌ی خانه" icon="home">
        {(Object.keys(HOME_LABELS) as (keyof HomeSections)[]).map((k) => (
          <Toggle key={k} label={HOME_LABELS[k]} value={s.home[k]} onChange={(v) => setHomeSection(k, v)} />
        ))}
      </Section>

      {canNotify || Platform.OS === 'web' ? (
        <Section title="اعلان‌ها و نصب" icon="bell">
          {canNotify ? (
            <>
              <Toggle label="اعلان فیلم و سریال جدید" hint="وقتی عنوان تازه‌ای اضافه شد خبرتان می‌کنیم" value={s.notifyNewContent} onChange={toggleNotify} />
              {s.notifyNewContent ? (
                <Button
                  label="ارسال اعلان آزمایشی"
                  icon="bell"
                  variant="surface"
                  onPress={async () => {
                    const ok = await notifyLocal({ title: 'ویسپار', body: 'اعلان‌ها درست کار می‌کنند.' });
                    if (!ok) toast('اعلان ارسال نشد', 'alert');
                  }}
                />
              ) : null}
            </>
          ) : null}
          {Platform.OS === 'web' && !isTV ? (
            installKind === 'ios' ? (
              <Button label="راهنمای افزودن به صفحه‌ی اصلی" icon="plus" variant="surface" onPress={openInstallGuide} />
            ) : installKind === 'prompt' ? (
              <Button label="نصب ویسپار روی این دستگاه" icon="download" variant="surface" onPress={() => void promptInstall()} />
            ) : detectStandalone() ? (
              <Text size={13} color="muted">
                ویسپار روی این دستگاه نصب است ✓
              </Text>
            ) : null
          ) : null}
          {Platform.OS === 'web' && !isTV ? (
            <LinkRow icon="desktop" title="نسخه‌ی ویندوز، مک و لینوکس" subtitle={`${repoUrl.replace('https://', '')}/releases`} url={`${repoUrl}/releases/latest`} />
          ) : null}
        </Section>
      ) : null}

      <Section title="پخش" icon="play">
        <Field label="کیفیت پیش‌فرض" hint="اگر این کیفیت نبود، نزدیک‌ترین کیفیت پایین‌تر پخش می‌شود">
          <Chip label="بهترین" selected={s.defaultQuality === 'best'} onPress={() => setSetting('defaultQuality', 'best')} />
          <Chip label="4K" selected={s.defaultQuality === '2160'} onPress={() => setSetting('defaultQuality', '2160')} />
          <Chip label="1080p" selected={s.defaultQuality === '1080'} onPress={() => setSetting('defaultQuality', '1080')} />
          <Chip label="720p" selected={s.defaultQuality === '720'} onPress={() => setSetting('defaultQuality', '720')} />
          <Chip label="480p · کم‌حجم" selected={s.defaultQuality === '480'} onPress={() => setSetting('defaultQuality', '480')} />
        </Field>
        {native ? (
          <Field label="پلیر" hint={Platform.OS === 'android' ? 'برنامه‌های نصب‌شده با ✓ مشخص شده‌اند' : undefined}>
            <Chip label="پلیر ویسپار" selected={s.playerMode === 'internal'} onPress={() => setSetting('playerMode', 'internal')} />
            <Chip label="هر بار بپرس" selected={s.playerMode === 'ask'} onPress={() => setSetting('playerMode', 'ask')} />
            {players.map((a) => (
              <Chip key={a.id} label={appLabel(a.id, a.name)} selected={s.playerMode === a.id} onPress={() => setSetting('playerMode', a.id)} />
            ))}
          </Field>
        ) : null}
        <Field label="نمای تصویر" hint="می‌توانید حین پخش هم عوضش کنید">
          <Chip label="اصلی" selected={s.videoFit === 'contain'} onPress={() => setSetting('videoFit', 'contain')} />
          <Chip label="پر کردن صفحه" selected={s.videoFit === 'cover'} onPress={() => setSetting('videoFit', 'cover')} />
          <Chip label="کشیده" selected={s.videoFit === 'fill'} onPress={() => setSetting('videoFit', 'fill')} />
        </Field>
        <Field label="پرش با دکمه‌های جلو و عقب">
          {([10, 15, 30] as const).map((n) => (
            <Chip key={n} label={`${faNum(n)} ثانیه`} selected={s.skipSeconds === n} onPress={() => setSetting('skipSeconds', n)} />
          ))}
        </Field>
        <Toggle label="پخش خودکار قسمت بعد" value={s.autoplayNext} onChange={(v) => setSetting('autoplayNext', v)} />
        <Toggle label="ادامه از جای قبلی بدون پرسش" value={s.autoResume} onChange={(v) => setSetting('autoResume', v)} />
      </Section>

      {native && !isTV ? (
        <Section title="دانلود" icon="download">
          <Field label="دانلودر" hint="مثل ADM یا 1DM؛ «مرورگر» یعنی مدیر دانلود سیستم">
            <Chip label="هر بار بپرس" selected={s.downloaderMode === 'ask'} onPress={() => setSetting('downloaderMode', 'ask')} />
            <Chip label="مرورگر" selected={s.downloaderMode === 'system'} onPress={() => setSetting('downloaderMode', 'system')} />
            {downloaders.map((a) => (
              <Chip key={a.id} label={appLabel(a.id, a.name)} selected={s.downloaderMode === a.id} onPress={() => setSetting('downloaderMode', a.id)} />
            ))}
          </Field>
        </Section>
      ) : null}

      <Section title="داده‌ها" icon="history">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Button
            label="پاک کردن تاریخچه"
            icon="trash"
            variant="surface"
            onPress={async () => {
              if (await confirm('پاک کردن تاریخچه', 'تاریخچه و ادامه‌ی تماشا پاک می‌شوند.', 'پاک کن')) {
                clearHistory();
                toast('تاریخچه پاک شد', 'check');
              }
            }}
          />
          <Button
            label="پاک کردن لیست من"
            icon="trash"
            variant="surface"
            onPress={async () => {
              if (await confirm('پاک کردن لیست من', 'همه‌ی موارد لیست حذف می‌شوند.', 'پاک کن')) {
                clearFavorites();
                toast('لیست پاک شد', 'check');
              }
            }}
          />
        </View>
      </Section>

      <Section title="درباره" icon="alert">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#08080C', alignItems: 'center', justifyContent: 'center' }}>
            <LogoMark size={40} onDark />
          </View>
          <View style={{ flex: 1 }}>
            <Text size={17} weight={800}>
              ویسپار
            </Text>
            <Text size={12} color="muted">
              نسخه {faVersion(up.currentVersion)} · {statusText}
            </Text>
          </View>
        </View>
        {native || up.supported ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              label={up.status === 'available' ? 'نصب نسخه‌ی جدید' : 'بررسی به‌روزرسانی'}
              icon={up.status === 'available' ? 'download' : 'refresh'}
              variant={up.status === 'available' ? 'primary' : 'surface'}
              loading={up.status === 'checking'}
              onPress={() => (up.status === 'available' ? up.install() : up.checkNow())}
              style={{ flex: 1 }}
            />
            {up.otaReady ? <Button label="اعمال به‌روزرسانی" onPress={up.applyOta} style={{ flex: 1 }} /> : null}
          </View>
        ) : null}
        <View style={{ height: 1, backgroundColor: colors.line }} />
        <View>
          <Text size={12} color="muted">
            طراحی و توسعه
          </Text>
          <Text size={15} weight={800}>
            {config.developer.name}
          </Text>
        </View>
        <View style={{ gap: 8 }}>
          <LinkRow icon="github" title="کد منبع در گیت‌هاب" subtitle={repoUrl.replace('https://', '')} url={repoUrl} />
          <LinkRow icon="globe" title="وب‌سایت توسعه‌دهنده" subtitle={config.developer.website.replace('https://', '')} url={config.developer.website} />
        </View>
      </Section>
    </ScrollView>
  );
}
