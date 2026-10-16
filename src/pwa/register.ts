import { Platform } from 'react-native';

import { startInstallCapture } from './install';

const HEAD_TAGS: { tag: 'link' | 'meta'; attrs: Record<string, string> }[] = [
  { tag: 'link', attrs: { rel: 'manifest', href: '/manifest.webmanifest' } },
  { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' } },
  { tag: 'meta', attrs: { name: 'theme-color', content: '#08080C' } },
  { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' } },
  { tag: 'meta', attrs: { name: 'mobile-web-app-capable', content: 'yes' } },
  { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: 'ویسپار' } },
  { tag: 'meta', attrs: { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' } },
];

/** Makes sure the PWA tags exist (they are baked in at build time; this covers the dev server) and registers the service worker. */
export function registerPwa() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  startInstallCapture();

  for (const { tag, attrs } of HEAD_TAGS) {
    const key = attrs.rel ?? attrs.name;
    const sel = `${tag}[${attrs.rel ? 'rel' : 'name'}="${key}"]`;
    if (document.head.querySelector(sel)) continue;
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.head.appendChild(el);
  }

  // The service worker caches the shell; skip it in dev so hot reload keeps working.
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}
