#!/usr/bin/env node
// Writes per-title HTML pages, list pages, the SPA fallback and the sitemap into dist/ (#62).
// Runs after `expo export -p web` and scripts/pwa-postbuild.js. Never fails the build because of the
// network: without the API it keeps the static pages and says why.
const fs = require('node:fs');
const path = require('node:path');

const { SITE_URL_DEFAULT } = require('./lib/web-head');
const { renderPage, titleMeta, titleBody, listBody, sitemapXml, SITE_NAME } = require('./lib/seo');

const DIST = path.join(__dirname, '..', 'dist');
const SITE = (process.env.SITE_URL || SITE_URL_DEFAULT).replace(/\/+$/, '');
const DEFAULT_API = 'https://cdnd.ehsanfazli.ir/api';
/**
 * Where to read the catalogue from, in order. The app's own base can be unreachable from the build
 * machine (on Vercel the prerender found no catalogue while GitHub's runners read 18,000 titles through
 * the public proxy), so the public proxy is always tried too. A key belongs to its own base only: the
 * proxy adds its key server-side.
 */
const CANDIDATES = [
  { base: process.env.SEO_API_BASE, key: process.env.SEO_API_KEY },
  { base: process.env.EXPO_PUBLIC_API_BASE, key: process.env.EXPO_PUBLIC_API_KEY },
  { base: DEFAULT_API, key: '' },
]
  .filter((c) => c.base && /^https?:\/\//.test(c.base))
  .map((c) => ({ base: c.base.replace(/\/+$/, ''), key: c.key || '' }))
  .filter((c, i, all) => all.findIndex((o) => o.base === c.base) === i);
let API = CANDIDATES[0] ? CANDIDATES[0].base : DEFAULT_API;
let KEY = CANDIDATES[0] ? CANDIDATES[0].key : '';

/** Host only, for logs: never print a key or a full upstream URL. */
const hostOf = (u) => {
  try {
    return new URL(u).host;
  } catch {
    return '?';
  }
};
const reason = (err) => [err && err.message, err && err.cause && (err.cause.code || err.cause.message)].filter(Boolean).join(': ');
const MAX_PAGES = Number(process.env.SEO_MAX_PAGES || 300);
const TIMEOUT_MS = 15000;

/** `getJson` with retries: the public proxy answers 502 for a while when its upstream is down. */
async function getJsonRetry(url, key = KEY, attempts = 4) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      return await getJson(url, key);
    } catch (err) {
      last = err;
      if (i + 1 < attempts) await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
    }
  }
  throw last;
}

async function getJson(url, key = KEY) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(key ? `${url}/${encodeURIComponent(key)}` : url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Every page of one catalogue, until an empty page, a repeat or MAX_PAGES. */
async function fetchAll(kind) {
  const seen = new Map();
  for (let page = 0; page < MAX_PAGES; page++) {
    let list;
    try {
      list = await getJsonRetry(`${API}/${kind}/by/filtres/0/created/${page}`);
    } catch (err) {
      if (page === 0) throw err;
      console.warn(`seo: ${kind} page ${page} failed (${reason(err)}); keeping ${seen.size} titles`);
      break;
    }
    const items = Array.isArray(list) ? list : [];
    const before = seen.size;
    for (const it of items) if (it && it.id && it.title && !seen.has(it.id)) seen.set(it.id, { ...it, type: kind === 'serie' ? 'serie' : 'movie' });
    if (!items.length || seen.size === before) break;
    if (page === MAX_PAGES - 1) console.warn(`seo: ${kind} stopped at the ${MAX_PAGES}-page cap (${seen.size} titles); raise SEO_MAX_PAGES if the catalogue is larger`);
  }
  return [...seen.values()];
}

function write(rel, html) {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

async function main() {
  const indexFile = path.join(DIST, 'index.html');
  if (!fs.existsSync(indexFile)) {
    console.error('dist/index.html not found; run the web export first');
    process.exit(1);
  }
  // Always start from the bare app shell, even if this ran before on the same dist/ (idempotent).
  const base = fs
    .readFileSync(indexFile, 'utf8')
    .replace(/<div id="root"><main[\s\S]*?<\/main><\/div>/, '<div id="root"></div>')
    .replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  const today = new Date().toISOString().slice(0, 10);

  // The SPA fallback (vercel.json rewrites unknown paths here) must not claim to be the homepage.
  write('app.html', renderPage(base, { title: SITE_NAME, description: 'ویسپار؛ تماشای فیلم و سریال روی موبایل، تلویزیون و کامپیوتر', canonical: null }));

  // The first base that answers with a list wins.
  let reachable = false;
  for (const c of CANDIDATES) {
    try {
      const probe = await getJsonRetry(`${c.base}/movie/by/filtres/0/created/0`, c.key);
      if (!Array.isArray(probe)) throw new Error('not a list');
      API = c.base;
      KEY = c.key;
      reachable = true;
      console.log(`seo: reading the catalogue from ${hostOf(c.base)}`);
      break;
    } catch (err) {
      console.warn(`seo: ${hostOf(c.base)} not usable (${reason(err)})`);
    }
  }

  let movies = [];
  let series = [];
  if (reachable) try {
    [movies, series] = await Promise.all([fetchAll('movie'), fetchAll('serie')]);
  } catch (err) {
    console.warn(`seo: catalogue failed (${reason(err)}); writing the static pages and sitemap only`);
  }
  if (!reachable) console.warn('seo: no catalogue base reachable; writing the static pages and sitemap only');

  const lists = [
    { rel: 'movies/index.html', loc: `${SITE}/movies`, heading: 'فیلم‌ها', intro: 'تازه‌ترین فیلم‌ها با زیرنویس فارسی و دوبله، در ویسپار.', items: movies },
    { rel: 'series/index.html', loc: `${SITE}/series`, heading: 'سریال‌ها', intro: 'تازه‌ترین سریال‌ها با زیرنویس فارسی و دوبله، در ویسپار.', items: series },
  ];
  for (const l of lists) {
    write(l.rel, renderPage(base, { title: `${l.heading} | ${SITE_NAME}`, description: l.intro, canonical: l.loc, body: listBody(l.heading, l.intro, l.items, SITE) }));
  }

  const titles = [...movies, ...series];
  for (const item of titles) {
    const meta = titleMeta(item, SITE);
    write(`${meta.path.slice(1)}/index.html`, renderPage(base, { title: meta.title, description: meta.description, canonical: meta.url, image: meta.image, ogType: meta.ogType, jsonLd: meta.jsonLd, body: titleBody(meta, item, SITE) }));
  }

  // The homepage keeps its canonical; it also links every title for crawlers that do not run JS.
  write('index.html', renderPage(base, {
    title: `${SITE_NAME} | تماشای فیلم و سریال با زیرنویس فارسی`,
    description: 'ویسپار؛ تماشای فیلم و سریال با زیرنویس فارسی و دوبله روی موبایل، تلویزیون و کامپیوتر.',
    canonical: `${SITE}/`,
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: `${SITE}/`, inLanguage: 'fa', potentialAction: { '@type': 'SearchAction', target: `${SITE}/search?q={search_term_string}`, 'query-input': 'required name=search_term_string' } },
    body: listBody(SITE_NAME, 'تماشای فیلم و سریال با زیرنویس فارسی و دوبله.', titles.slice(0, 60), SITE),
  }));

  write('sitemap.xml', sitemapXml([
    { loc: `${SITE}/`, lastmod: today, priority: '1.0' },
    { loc: `${SITE}/movies`, lastmod: today, priority: '0.8' },
    { loc: `${SITE}/series`, lastmod: today, priority: '0.8' },
    ...titles.map((it) => ({ loc: titleMeta(it, SITE).url, lastmod: today, priority: '0.6' })),
  ]));

  console.log(`seo: ${movies.length} movies, ${series.length} series prerendered; sitemap has ${titles.length + 3} URLs`);
}

main().catch((err) => {
  // A bug here must not take the deploy down: the app itself is already built.
  console.warn(`seo: skipped (${err && err.message})`);
});
