import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { usePoster, useSeasons } from '@/api/hooks';
import type { Episode } from '@/api/types';
import { Art } from '@/components/Art';
import { Button } from '@/components/Button';
import { DetailHeader } from '@/components/DetailHeader';
import { Focusable } from '@/components/Focusable';
import { Icon } from '@/components/Icon';
import { NotFound } from '@/components/NotFound';
import { QualitySheet } from '@/components/QualitySheet';
import { ErrorState, Skeleton } from '@/components/States';
import { Text } from '@/components/Text';
import { toast } from '@/components/Toast';
import { play, type PlayContext } from '@/external/actions';
import { useLayout } from '@/hooks/useLayout';
import { isFinished, lastEpisodeOf, progressKey, useProgressMap } from '@/library/store';
import { faNum } from '@/lib/format';
import { pickSource } from '@/lib/sources';
import { getSettings } from '@/settings/store';
import { useTheme } from '@/theme/ThemeProvider';

export default function SeriesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { isTV, isWide, width, gutter } = useLayout();
  const seriesId = Number(id);
  const q = usePoster('serie', seriesId);
  const seasons = useSeasons(q.data ? seriesId : null);
  const progress = useProgressMap();
  const [seasonIdx, setSeasonIdx] = useState(0);
  const [picked, setPicked] = useState<{ episode: Episode; s: number; e: number } | null>(null);
  const last = useMemo(() => lastEpisodeOf(progress, seriesId), [progress, seriesId]);

  // Open on the season the user was last watching.
  useEffect(() => setSeasonIdx(last?.episode?.seasonIndex ?? 0), [seriesId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  const show = q.data;
  if (!show) return <NotFound />;

  const list = seasons.data ?? [];
  const season = list[seasonIdx];
  const totalEpisodes = list.reduce((n, s) => n + s.episodes.length, 0);
  const extraMeta = list.length ? `${faNum(list.length)} فصل · ${faNum(totalEpisodes)} قسمت` : undefined;
  const seasonLabel = (i: number) => (list[i]?.title ? faNum(list[i].title) : `فصل ${faNum(i + 1)}`);
  const ctxFor = (s: number, e: number): PlayContext => ({ type: 'serie', id: show.id, title: show.title, seasonIndex: s, episodeIndex: e });

  const playEpisode = (s: number, e: number) => {
    const ep = list[s]?.episodes[e];
    if (!ep) return;
    const src = pickSource(ep.sources, getSettings().defaultQuality);
    if (!src) {
      toast('برای این قسمت لینکی ثبت نشده', 'alert');
      return;
    }
    play(src, ctxFor(s, e));
  };

  // Primary action: continue the last episode (or the next one if it was finished), else S1E1.
  let target: { s: number; e: number; label: string } | null = null;
  if (last?.episode && list.length) {
    const { seasonIndex: s, episodeIndex: e } = last.episode;
    if (!isFinished(last)) target = { s, e, label: `ادامه‌ی ${seasonLabel(s)} · قسمت ${faNum(e + 1)}` };
    else if (list[s]?.episodes[e + 1]) target = { s, e: e + 1, label: `پخش ${seasonLabel(s)} · قسمت ${faNum(e + 2)}` };
    else if (list[s + 1]?.episodes.length) target = { s: s + 1, e: 0, label: `پخش ${seasonLabel(s + 1)} · قسمت ${faNum(1)}` };
  }
  if (!target && list[0]?.episodes.length) target = { s: 0, e: 0, label: `پخش ${seasonLabel(0)} · قسمت ${faNum(1)}` };

  const twoCols = isWide || isTV || width >= 700;
  const epWidth = twoCols ? Math.min(560, (Math.min(width, 1440) - gutter * 2 - 16) / 2) : undefined;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 48 }}>
      <DetailHeader
        poster={show}
        extraMeta={extraMeta}
        actions={
          target ? (
            <Button
              label={target.label}
              icon="play"
              size="lg"
              hasTVPreferredFocus={isTV}
              style={{ flex: 1 }}
              onPress={() => {
                setSeasonIdx(target!.s);
                playEpisode(target!.s, target!.e);
              }}
            />
          ) : seasons.isLoading ? (
            <Button label="در حال بارگذاری قسمت‌ها" icon="play" size="lg" loading style={{ flex: 1 }} />
          ) : null
        }
      >
        {seasons.isLoading ? (
          <View style={{ gap: 12 }}>
            <Skeleton style={{ height: 50, borderRadius: 16 }} />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} style={{ height: 78, borderRadius: 12 }} />
            ))}
          </View>
        ) : seasons.error ? (
          <ErrorState error={seasons.error} onRetry={() => seasons.refetch()} compact />
        ) : list.length === 0 ? (
          <Text size={13} color="muted">
            هنوز قسمتی برای این سریال ثبت نشده است.
          </Text>
        ) : (
          <View style={{ gap: 14 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 6, padding: 5, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
                {list.map((s, i) => {
                  const active = i === seasonIdx;
                  return (
                    <Focusable
                      key={s.id || i}
                      onPress={() => setSeasonIdx(i)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      ringRadius={12}
                      style={{ minWidth: 84, height: 40, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.chipActiveBg : 'transparent' }}
                    >
                      <Text size={14} weight={active ? 800 : 600} color={active ? colors.chipActiveText : 'text2'} line={1.4}>
                        {seasonLabel(i)}
                      </Text>
                    </Focusable>
                  );
                })}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text size={16} weight={800} accessibilityRole="header">
                قسمت‌ها
              </Text>
              <Text size={12} color="muted">
                {faNum(season?.episodes.length ?? 0)} قسمت
              </Text>
            </View>

            <View style={{ gap: 14, flexDirection: twoCols ? 'row' : 'column', flexWrap: 'wrap' }}>
              {(season?.episodes ?? []).map((ep, i) => {
                const p = progress[progressKey('serie', show.id, ep.id || seasonIdx * 1000 + i)];
                const pct = p && p.duration ? Math.min(1, p.position / p.duration) : 0;
                const done = p ? isFinished(p) : false;
                const current = last?.episode?.seasonIndex === seasonIdx && last.episode.episodeIndex === i;
                return (
                  <View key={ep.id || i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, width: epWidth ?? '100%' }}>
                    <Focusable
                      onPress={() => playEpisode(seasonIdx, i)}
                      accessibilityRole="button"
                      accessibilityLabel={`پخش قسمت ${faNum(i + 1)}، ${ep.title}${done ? '، دیده شده' : ''}`}
                      ringRadius={12}
                      style={{ flex: 1, flexDirection: 'row', gap: 12 }}
                    >
                      <Art uri={ep.image || show.cover} seed={show.id + i} radius={12} style={{ width: 136, height: 78, alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(8,8,12,0.65)', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name={done ? 'check' : 'play'} size={done ? 16 : 13} color="#F4F1EA" />
                        </View>
                        {pct > 0.02 ? (
                          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.25)', direction: 'ltr' }}>
                            <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: colors.accent }} />
                          </View>
                        ) : null}
                      </Art>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text size={12} weight={700} color={current ? 'accentText' : 'text2'}>
                          قسمت {faNum(i + 1)}
                          {done ? ' · دیده شده' : current ? ' · در حال تماشا' : ''}
                        </Text>
                        <Text size={14} weight={700} numberOfLines={1}>
                          {ep.title ? faNum(ep.title) : `قسمت ${faNum(i + 1)}`}
                        </Text>
                        <Text size={12} color="muted" numberOfLines={2}>
                          {[ep.duration ? faNum(ep.duration) : null, ep.description].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                    </Focusable>
                    <Focusable
                      onPress={() => setPicked({ episode: ep, s: seasonIdx, e: i })}
                      accessibilityRole="button"
                      accessibilityLabel={`کیفیت‌ها و دانلود قسمت ${faNum(i + 1)}`}
                      ringRadius={12}
                      style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Icon name="more" size={20} color="muted" />
                    </Focusable>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </DetailHeader>

      <QualitySheet
        visible={!!picked}
        onClose={() => setPicked(null)}
        title={picked?.episode.title ? faNum(picked.episode.title) : picked ? `قسمت ${faNum(picked.e + 1)}` : ''}
        subtitle={picked ? `${show.title} · ${seasonLabel(picked.s)} · قسمت ${faNum(picked.e + 1)}` : undefined}
        sources={picked?.episode.sources ?? []}
        ctx={picked ? ctxFor(picked.s, picked.e) : ctxFor(0, 0)}
      />
    </ScrollView>
  );
}
