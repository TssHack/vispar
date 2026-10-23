import { router } from 'expo-router';
import { Platform } from 'react-native';

import type { ContentType, Source } from '@/api/types';
import { canPlayInApp, containerLabel, containerOf } from '@/lib/containers';
import { appPlatform } from '@/lib/platform';
import { getSettings } from '@/settings/store';
import { isDesktopApp } from '@/update/target';

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

/** The web app is for browsing: HTTPS pages cannot load these plain-HTTP files, so playing hands off to an external player. */
const webHandsOff = Platform.OS === 'web' && !isDesktopApp;

/** Why the built-in player is not offered for this file, or undefined when it is. */
export function unplayableNote(source: Source): string | undefined {
  if (canPlayInApp(source, appPlatform())) return undefined;
  const container = containerLabel(containerOf(source)) || 'این';
  return `این فایل ${container} است و پلیر داخلی iOS آن را پخش نمی‌کند. با VLC، Infuse یا nPlayer باز کنید.`;
}

export function playInternal(source: Source, ctx: PlayContext, replace = false) {
  if (webHandsOff || !canPlayInApp(source, appPlatform())) {
    // Never hand a file the decoder cannot play to the player screen: explain and offer the others.
    openExternalSheet({ kind: 'player', url: source.url, title: ctx.title, note: unplayableNote(source) });
    return;
  }
  const nav = { pathname: '/player' as const, params: playerParams(source, ctx) };
  if (replace) router.replace(nav);
  else router.push(nav);
}

/** Plays according to the user's "player" setting: Vispar, always ask, or a chosen app. */
export function play(source: Source, ctx: PlayContext, opts: { forceChooser?: boolean } = {}) {
  const mode = getSettings().playerMode;
  const inApp = canPlayInApp(source, appPlatform());
  if (opts.forceChooser || mode === 'ask' || webHandsOff || (!inApp && mode === 'internal')) {
    openExternalSheet({
      kind: 'player',
      url: source.url,
      title: ctx.title,
      playInternal: webHandsOff || !inApp ? undefined : () => playInternal(source, ctx),
      note: unplayableNote(source),
    });
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
