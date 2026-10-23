import { View } from 'react-native';

import type { Source } from '@/api/types';
import { download, play, type PlayContext } from '@/external/actions';
import { useLayout } from '@/hooks/useLayout';
import { canPlayInApp } from '@/lib/containers';
import { isStreamOnly, qualityLabel, shortQuality } from '@/lib/format';
import { appPlatform } from '@/lib/platform';
import { pickSource, sortSources } from '@/lib/sources';
import { useTheme } from '@/theme/ThemeProvider';

import { Focusable } from './Focusable';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

function SquareButton({ icon, label, onPress, primary }: { icon: IconName; label: string; onPress: () => void; primary?: boolean }) {
  const { colors } = useTheme();
  return (
    <Focusable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      ringRadius={12}
      style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? colors.accent : 'transparent',
        borderWidth: primary ? 0 : 1,
        borderColor: colors.lineStrong,
      }}
    >
      <Icon name={icon} size={icon === 'play' ? 14 : 18} color={primary ? colors.onAccent : colors.text} />
    </Focusable>
  );
}

/** One row per source: quality, label, play, "play with…" and (for files) download. */
export function SourceList({ sources, ctx, onDone }: { sources: Source[]; ctx: PlayContext; onDone?: () => void }) {
  const { colors } = useTheme();
  const { isTV } = useLayout();
  const sorted = sortSources(sources);
  const platform = appPlatform();
  // The recommended row is the one the app would actually pick here, not just the highest quality.
  const recommended = pickSource(sorted, 'best', { platform });
  if (sorted.length === 0) {
    return (
      <Text size={13} color="muted">
        لینک پخشی برای این مورد ثبت نشده است.
      </Text>
    );
  }
  return (
    <View style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
      {sorted.map((s, i) => {
        const best = s.url === recommended?.url;
        const stream = isStreamOnly(s);
        const external = !canPlayInApp(s, platform);
        return (
          <View
            key={`${s.id}-${s.url}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderBottomWidth: i < sorted.length - 1 ? 1 : 0,
              borderBottomColor: colors.line,
            }}
          >
            <View style={{ minWidth: 56, height: 32, paddingHorizontal: 8, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: best ? colors.accentSoft : colors.surface2 }}>
              <Text size={12} weight={800} color={best ? 'accentText' : 'text2'} line={1.3} style={{ writingDirection: 'ltr' }}>
                {shortQuality(s.quality) || '—'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text size={14} weight={700}>
                {qualityLabel(s.quality)}
              </Text>
              <Text size={12} color="muted">
                {[s.type.toUpperCase(), best ? 'پیشنهادی' : null, stream ? 'فقط پخش آنلاین' : null, external ? 'فقط با پلیر دیگر' : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <SquareButton
              icon="play"
              label={`پخش ${s.quality}`}
              primary={best}
              onPress={() => {
                onDone?.();
                play(s, ctx);
              }}
            />
            <SquareButton
              icon="external"
              label={`پخش ${s.quality} با پلیر دیگر`}
              onPress={() => {
                onDone?.();
                play(s, ctx, { forceChooser: true });
              }}
            />
            {!stream && !isTV ? (
              <SquareButton
                icon="download"
                label={`دانلود ${s.quality}`}
                onPress={() => {
                  onDone?.();
                  download(s, ctx.title);
                }}
              />
            ) : !isTV ? (
              <View style={{ width: 44 }} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
