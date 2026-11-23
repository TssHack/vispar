import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

import { documentTitle, posterPageMeta } from '@/lib/pageMetaText';

const require = createRequire(import.meta.url);
const seo = require('../scripts/lib/seo.js');
const { injectHead, verificationTags } = require('../scripts/lib/web-head.js');

// A real catalogue item (trimmed), as the API returns it.
const movie = JSON.parse(readFileSync('tests/fixtures/seo-movie.json', 'utf8'));
const SITE = 'https://vispar.ehsanfazli.ir';
const BASE = `<!DOCTYPE html><html><head><title>ویسپار</title><meta name="description" content="x" /><link rel="canonical" href="${SITE}/" /><meta property="og:url" content="${SITE}/" /><meta property="og:image" content="${SITE}/og.png" /></head><body><div id="root"></div></body></html>`;

describe('title page metadata from a real catalogue card', () => {
  const m = seo.titleMeta(movie, SITE);

  it('gets its own path, canonical URL, Persian name and story', () => {
    expect(m.path).toBe('/movie/36074');
    expect(m.url).toBe(`${SITE}/movie/36074`);
    expect(m.nameFa).toBe('آخرین وسوسه بکی');
    expect(m.story.startsWith('بکی که اکنون به عنوان مامور میدانی سیا')).toBe(true);
    expect(m.title).toContain('آخرین وسوسه بکی (The Last Temptation of Becky) 2026');
    expect(m.description.length).toBeLessThanOrEqual(155);
  });

  it('describes it as a Movie in JSON-LD', () => {
    expect(m.jsonLd).toMatchObject({ '@type': 'Movie', name: 'The Last Temptation of Becky', alternateName: 'آخرین وسوسه بکی', datePublished: '2026', genre: ['هیجان انگیز'], inLanguage: 'fa' });
    expect(seo.titleMeta({ ...movie, type: 'serie' }, SITE).jsonLd['@type']).toBe('TVSeries');
    expect(seo.titleMeta({ ...movie, type: 'serie' }, SITE).path).toBe('/series/36074');
  });
});

describe('renderPage', () => {
  const m = seo.titleMeta(movie, SITE);
  const html = seo.renderPage(BASE, { title: m.title, description: m.description, canonical: m.url, image: m.image, ogType: m.ogType, jsonLd: m.jsonLd, body: seo.titleBody(m, movie, SITE) });

  it('replaces the homepage canonical with the page own one (the bug: every page pointed at /)', () => {
    expect(html).toContain(`<link rel="canonical" href="${SITE}/movie/36074" />`);
    expect(html).not.toContain(`href="${SITE}/" />`);
    expect(html).toContain(`<meta property="og:url" content="${SITE}/movie/36074" />`);
  });

  it('puts readable content in #root for crawlers without JavaScript', () => {
    expect(html).toMatch(/<div id="root"><main[^>]*><nav>.*<h1>فیلم The Last Temptation of Becky \(2026\)<\/h1>/);
    expect(html).toContain('<script type="application/ld+json">');
  });

  it('escapes HTML and cannot be closed early by a title containing </script>', () => {
    const evil = seo.titleMeta({ ...movie, title: 'A</script><script>alert(1)</script>"&' }, SITE);
    const out = seo.renderPage(BASE, { title: evil.title, description: evil.description, canonical: evil.url, jsonLd: evil.jsonLd, body: seo.titleBody(evil, { ...movie, title: 'A</script><script>alert(1)</script>"&' }, SITE) });
    expect(out).not.toContain('<script>alert(1)</script>');
    expect(out.match(/<\/script>/g)?.length).toBe(1);
  });

  it('gives the SPA fallback no canonical at all, so it never claims to be the homepage', () => {
    const fallback = seo.renderPage(BASE, { title: 'ویسپار', description: 'x', canonical: null });
    expect(fallback).not.toContain('rel="canonical"');
    expect(fallback).not.toContain('og:url');
  });

  it('is idempotent on JSON-LD (no duplicates when rendered twice)', () => {
    const twice = seo.renderPage(html, { title: m.title, description: m.description, canonical: m.url, jsonLd: m.jsonLd });
    expect(twice.match(/application\/ld\+json/g)?.length).toBe(1);
  });
});

describe('sitemap', () => {
  it('lists every URL with lastmod, escaped', () => {
    const xml = seo.sitemapXml([{ loc: `${SITE}/`, lastmod: '2026-11-21', priority: '1.0' }, { loc: `${SITE}/movie/1?a=1&b=2` }]);
    expect(xml).toContain(`<loc>${SITE}/</loc><lastmod>2026-11-21</lastmod><priority>1.0</priority>`);
    expect(xml).toContain('a=1&amp;b=2');
    expect(xml.startsWith('<?xml')).toBe(true);
  });
});

describe('search engine verification', () => {
  it('adds the Google and Bing tags only when the tokens are set', () => {
    // Google's token for vispar.ehsanfazli.ir is built in; Bing's only when set.
    expect(verificationTags({}).map((t: { tag: string }) => t.tag)).toEqual(['<meta name="google-site-verification" content="qMovZ5uUbjXKycz0mfGVuukURhrH3A9CzAp0o_sDlxc" />']);
    const html = injectHead('<html><head><title>x</title></head><body></body></html>', { env: { GOOGLE_SITE_VERIFICATION: 'abcDEF_123-xyz', BING_SITE_VERIFICATION: '0123456789ABCDEF' } });
    expect(html).toContain('<meta name="google-site-verification" content="abcDEF_123-xyz" />');
    expect(html).toContain('<meta name="msvalidate.01" content="0123456789ABCDEF" />');
  });

  it('refuses a token that could break out of the attribute', () => {
    expect(verificationTags({ GOOGLE_SITE_VERIFICATION: 'x" /><script>' }).map((t: { tag: string }) => t.tag).join('')).not.toContain('<script>');
  });
});

describe('runtime page titles', () => {
  it('names the page after the title, and drops the canonical while loading', () => {
    expect(documentTitle('فیلم X 2026')).toBe('فیلم X 2026 | ویسپار');
    expect(documentTitle(null)).toBe('ویسپار');
    expect(posterPageMeta(undefined, 'movie')).toEqual({ title: null, path: null });
    const m = posterPageMeta({ id: 36074, title: movie.title, year: 2026, description: movie.description }, 'movie');
    expect(m.path).toBe('/movie/36074');
    expect(m.title).toBe('فیلم The Last Temptation of Becky 2026');
    expect(m.description!.length).toBeLessThanOrEqual(160);
  });
});

describe('deployment wiring', () => {
  it('rewrites unknown paths to the fallback, not to the homepage', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
    expect(vercel.rewrites).toEqual([{ source: '/(.*)', destination: '/app.html' }]);
  });
  it('runs the prerender after the PWA step in the web build', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.scripts['build:web']).toMatch(/pwa-postbuild\.js && node scripts\/prerender-seo\.js$/);
  });
});
