import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const { injectHead } = createRequire(import.meta.url)('../scripts/lib/web-head.js') as { injectHead: (html: string, o?: { site?: string }) => string };

// What `expo export -p web` produces, trimmed.
const EXPORTED = `<!doctype html>
<html lang="fa">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
    <title>ویسپار</title>
  <meta name="theme-color" content="#08080C">
<link rel="icon" href="/favicon.ico"/>
  </head>
  <body></body>
</html>`;

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe('injectHead', () => {
  const out = injectHead(EXPORTED);

  it('sets the document direction and keeps the language', () => {
    expect(out).toContain('<html lang="fa" dir="rtl">');
  });

  it('adds Open Graph, Twitter and canonical tags with absolute URLs', () => {
    expect(out).toContain('<meta property="og:image" content="https://vispar.ehsanfazli.ir/og.png" />');
    expect(out).toContain('<meta property="og:url" content="https://vispar.ehsanfazli.ir/" />');
    expect(out).toContain('<link rel="canonical" href="https://vispar.ehsanfazli.ir/" />');
    expect(out).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(out).toContain('<meta name="twitter:image" content="https://vispar.ehsanfazli.ir/og.png" />');
  });

  it('keeps the PWA tags and fixes the viewport for the iOS notch', () => {
    expect(out).toContain('rel="manifest"');
    expect(out).toContain('apple-mobile-web-app-capable');
    expect(out).toContain('viewport-fit=cover');
  });

  it('does not duplicate a tag the template already has', () => {
    expect(count(out, /name="theme-color"/g)).toBe(1);
  });

  it('is idempotent', () => {
    expect(injectHead(out)).toBe(out);
  });

  it('uses another site origin when given one (trailing slash tolerated)', () => {
    const other = injectHead(EXPORTED, { site: 'https://example.test/' });
    expect(other).toContain('content="https://example.test/og.png"');
    expect(other).not.toContain('vispar.ehsanfazli.ir');
  });

  it('adds dir to an html tag that has no lang either', () => {
    expect(injectHead('<html><head></head></html>')).toContain('<html lang="fa" dir="rtl">');
  });
});
