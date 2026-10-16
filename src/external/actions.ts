import { router } from 'expo-router';
import { Platform } from 'react-native';

import type { ContentType, Source } from '@/api/types';
import { getSettings } from '@/settings/store';

import { findApp } from './apps';
import { downloadWithSystem, openInApp } from './launch';
import { openExternalSheet } from './sheet';

/** What the player needs to find sources, the next episode and where to save progress. */
export type PlayContext = {
  type: ContentType;
  id: number;
  title: string;
  /** Series only. */
  seasonIndex?: number;
  episodeIndex?: number;
};

export function playerParams(source: Source, ctx: PlayContext) {
  return {
    url: source.url,
    q: source.quality,
    title: ctx.title,
    type: ctx.type,
    id: String(ctx.id),
    ...(ctx.seasonIndex !== undefined ? { s: String(ctx.seasonIndex) } : {}),
    ...(ctx.episodeIndex !== undefined ? { e: String(ctx.episodeIndex) } : {}),
  };
}

export function playInternal(source: Source, ctx: PlayContext, replace = false) {
  const nav = { pathname: '/player' as const, params: playerParams(source, ctx) };
  if (replace) router.replace(nav);
  else router.push(nav);
}

/** Plays according to the user's "player" setting: Vispar, always ask, or a chosen app. */
export function play(source: Source, ctx: PlayContext, opts: { forceChooser?: boolean } = {}) {
  const mode = getSettings().playerMode;
  if (opts.forceChooser || mode === 'ask') {
    openExternalSheet({ kind: 'player', url: source.url, title: ctx.title, playInternal: () => playInternal(source, ctx) });
    return;
  }
  const app = mode !== 'internal' ? findApp(mode) : null;
  if (app && Platform.OS !== 'web') {
    openInApp(app, source.url, ctx.title);
    return;
  }
  playInternal(source, ctx);
}

/** Downloads according to the user's "downloader" setting. */
export function download(source: Source, title: string, opts: { forceChooser?: boolean } = {}) {
  const mode = getSettings().downloaderMode;
  if (opts.forceChooser || mode === 'ask') {
    openExternalSheet({ kind: 'downloader', url: source.url, title });
    return;
  }
  const app = mode !== 'system' ? findApp(mode) : null;
  if (app && Platform.OS !== 'web') {
    openInApp(app, source.url, title);
    return;
  }
  downloadWithSystem(source.url, title);
}
