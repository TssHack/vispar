import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { usePoster } from '@/api/hooks';
import { Button } from '@/components/Button';
import { DetailHeader } from '@/components/DetailHeader';
import { NotFound } from '@/components/NotFound';
import { SourceList } from '@/components/SourceList';
import { Text } from '@/components/Text';
import { download, play, type PlayContext } from '@/external/actions';
import { useLayout } from '@/hooks/useLayout';
import { canResume, progressKey, useProgressMap } from '@/library/store';
import { faClock, faNum, faScore, faYear, isStreamOnly } from '@/lib/format';
import { canPlayInApp, containerLabel, containerOf } from '@/lib/containers';
import { appPlatform } from '@/lib/platform';
import { pickSource } from '@/lib/sources';
import { useSetting } from '@/settings/store';
import { useTheme } from '@/theme/ThemeProvider';

function Spec({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  if (!value) return null;
  return (
    <View style={{ flexGrow: 1, flexBasis: 150, padding: 14, borderRadius: 14, backgroundColor: colors.surface, gap: 2 }}>
      <Text size={12} color="muted">
        {label}
      </Text>
      <Text size={14} weight={700}>
        {value}
      </Text>
    </View>
  );
}

export default function MovieScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { isTV } = useLayout();
  const defaultQuality = useSetting('defaultQuality');
  const progress = useProgressMap();
  const q = usePoster('movie', Number(id));
  const movie = q.data;

  if (q.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!movie) return <NotFound />;

  const ctx: PlayContext = { type: 'movie', id: movie.id, title: movie.title };
  const src = pickSource(movie.sources, defaultQuality, { platform: appPlatform() });
  const saved = progress[progressKey('movie', movie.id)];
  const resumable = canResume(saved);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 48 }}>
      <DetailHeader
        poster={movie}
        actions={
          <>
            <Button
              label={!src ? 'لینک پخش موجود نیست' : !canPlayInApp(src, appPlatform()) ? `پخش با پلیر دیگر · ${containerLabel(containerOf(src))}` : resumable ? `ادامه از ${faClock(saved!.position)}` : `پخش · ${src.quality}`}
              icon="play"
              size="lg"
              disabled={!src}
              hasTVPreferredFocus={isTV}
              onPress={() => src && play(src, ctx)}
              style={{ flex: 1 }}
            />
            {src && !isStreamOnly(src) && !isTV ? <Button icon="download" variant="surface" size="lg" accessibilityLabel="دانلود" onPress={() => download(src, movie.title)} /> : null}
          </>
        }
      >
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text size={16} weight={800} accessibilityRole="header">
              کیفیت‌ها
            </Text>
            <Text size={12} color="muted">
              {faNum(movie.sources.length)} منبع
            </Text>
          </View>
          <SourceList sources={movie.sources} ctx={ctx} />
        </View>
        <View style={{ gap: 10 }}>
          <Text size={16} weight={800} accessibilityRole="header">
            مشخصات
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Spec label="سال" value={faYear(movie.year)} />
            <Spec label="مدت" value={movie.duration ? faNum(movie.duration) : ''} />
            <Spec label="کشور" value={movie.country.map((c) => c.title).join('، ')} />
            <Spec label="امتیاز IMDb" value={faScore(movie.imdb) ? `${faScore(movie.imdb)} از ${faNum(10)}` : ''} />
            <Spec label="ژانر" value={movie.genres.map((g) => g.title).join('، ')} />
          </View>
        </View>
      </DetailHeader>
    </ScrollView>
  );
}
