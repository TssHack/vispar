// Pure SEO helpers for the web build (#62): per-title pages, JSON-LD and the sitemap.
// Used by scripts/prerender-seo.js and unit tested in tests/seo.test.ts.

const SITE_NAME = 'ویسپار';

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** JSON for a <script type="application/ld+json">: `</script>` inside a string must not end the tag. */
const jsonForScript = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

const clean = (s) =>
  String(s ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .trim();

/** The story from a catalogue description card ("... خلاصه داستان : ..."), or the whole text. */
function synopsisOf(description) {
  const text = clean(description);
  const m = /خلاصه(?:\s|‌)*ی?\s*(?:داستان|سریال)\s*[:：]?/.exec(text);
  let story = m ? text.slice(m.index + m[0].length) : text;
  // Drop the notes the card appends after the story (subtitle / dub / source lines).
  story = story
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^(زیرنویس|دوبله|منبع|وضعیت)/.test(l))
    .join(' ');
  return story.replace(/\s+/g, ' ').trim();
}

/** "نام پارسی: آخرین وسوسه بکی" from the card, when there is one. */
function persianNameOf(description) {
  const m = /نام\s*(?:پارسی|فارسی)\s*[:：]\s*([^\n]+)/.exec(clean(description));
  return m ? m[1].trim() : '';
}

/** Cut at a word boundary, with an ellipsis, for meta descriptions (~155 chars). */
function truncate(s, max = 155) {
  const t = String(s ?? '').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`;
}

/** Everything a title page needs: path, texts, image and JSON-LD. */
function titleMeta(item, site) {
  const type = item.type === 'serie' ? 'serie' : 'movie';
  const kind = type === 'serie' ? 'سریال' : 'فیلم';
  const path = `/${type === 'serie' ? 'series' : 'movie'}/${item.id}`;
  const url = `${site}${path}`;
  const nameFa = persianNameOf(item.description);
  const story = synopsisOf(item.description);
  const year = item.year ? String(item.year) : '';
  const genres = (item.genres || []).map((g) => g && g.title).filter(Boolean);
  const countries = (item.country || []).map((c) => c && c.title).filter(Boolean);
  const label = nameFa && nameFa !== item.title ? `${nameFa} (${item.title})` : item.title;
  const title = `${kind} ${label}${year ? ` ${year}` : ''} | تماشا با زیرنویس فارسی | ${SITE_NAME}`;
  const description = truncate(
    story ? `${kind} ${nameFa || item.title}${year ? ` ${year}` : ''}: ${story}` : `تماشای ${kind} ${label}${year ? ` محصول ${year}` : ''}${genres.length ? `، ${genres.join('، ')}` : ''} در ${SITE_NAME}.`,
  );
  const image = item.cover || item.image || `${site}/og.png`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': type === 'serie' ? 'TVSeries' : 'Movie',
    name: item.title,
    ...(nameFa && nameFa !== item.title ? { alternateName: nameFa } : {}),
    url,
    ...(item.image ? { image: item.image } : {}),
    ...(story ? { description: truncate(story, 500) } : {}),
    ...(year ? { datePublished: year } : {}),
    ...(genres.length ? { genre: genres } : {}),
    ...(countries.length ? { countryOfOrigin: countries.map((name) => ({ '@type': 'Country', name })) } : {}),
    inLanguage: 'fa',
  };
  return { path, url, title, description, image, story, nameFa, kind, genres, year, jsonLd, ogType: type === 'serie' ? 'video.tv_show' : 'video.movie' };
}

/** Replaces or adds one head tag, matched by `key`. */
function setTag(html, key, tag) {
  return key.test(html) ? html.replace(key, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

/**
 * The app's index.html, made into one page: its own title, description, canonical, social tags and
 * JSON-LD, plus `body` inside #root so crawlers see the content without JavaScript (React replaces
 * it when the app starts). `canonical: null` removes the canonical (the generic SPA fallback).
 */
function renderPage(baseHtml, { title, description, canonical, image, ogType = 'website', jsonLd, body = '' }) {
  let html = baseHtml;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
  html = setTag(html, /<meta name="description"[^>]*>/, `<meta name="description" content="${escapeHtml(description)}" />`);
  if (canonical) html = setTag(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${escapeHtml(canonical)}" />`);
  else html = html.replace(/\s*<link rel="canonical"[^>]*>/, '');
  html = setTag(html, /<meta property="og:type"[^>]*>/, `<meta property="og:type" content="${ogType}" />`);
  html = setTag(html, /<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = setTag(html, /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeHtml(description)}" />`);
  if (canonical) html = setTag(html, /<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${escapeHtml(canonical)}" />`);
  else html = html.replace(/\s*<meta property="og:url"[^>]*>/, '');
  if (image) {
    html = setTag(html, /<meta property="og:image"(?!:)[^>]*>/, `<meta property="og:image" content="${escapeHtml(image)}" />`);
    html = setTag(html, /<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${escapeHtml(image)}" />`);
  }
  html = setTag(html, /<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  html = setTag(html, /<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${escapeHtml(description)}" />`);
  html = html.replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  if (jsonLd) html = html.replace('</head>', `    <script type="application/ld+json">${jsonForScript(jsonLd)}</script>\n  </head>`);
  if (body) html = html.replace(/<div id="root"><\/div>/, `<div id="root">${body}</div>`);
  return html;
}

const SHELL_STYLE =
  'max-width:760px;margin:0 auto;padding:32px 20px;font-family:Arad,Tahoma,sans-serif;color:#F4F1EA;background:#08080C;line-height:1.9';

/** Crawler-visible content of a title page. Same facts the app shows, plain HTML. */
function titleBody(meta, item, site) {
  const genres = meta.genres.length ? `<p>ژانر: ${meta.genres.map(escapeHtml).join('، ')}</p>` : '';
  const rating = item.imdb ? `<p>امتیاز IMDb: ${escapeHtml(item.imdb)}</p>` : '';
  return [
    `<main style="${SHELL_STYLE}">`,
    `<nav><a href="${site}/" style="color:#F2B544">${SITE_NAME}</a> › <a href="${site}/${meta.kind === 'سریال' ? 'series' : 'movies'}" style="color:#F2B544">${meta.kind === 'سریال' ? 'سریال‌ها' : 'فیلم‌ها'}</a></nav>`,
    `<h1>${escapeHtml(meta.kind)} ${escapeHtml(item.title)}${meta.year ? ` (${escapeHtml(meta.year)})` : ''}</h1>`,
    meta.nameFa && meta.nameFa !== item.title ? `<h2>${escapeHtml(meta.nameFa)}</h2>` : '',
    item.image ? `<img src="${escapeHtml(item.image)}" alt="پوستر ${escapeHtml(meta.nameFa || item.title)}" width="240" loading="lazy" />` : '',
    genres,
    rating,
    meta.story ? `<p>${escapeHtml(meta.story)}</p>` : '',
    '</main>',
  ].join('');
}

/** A list page body: heading, intro and links to every title, so crawlers can reach them all. */
function listBody(heading, intro, items, site) {
  const links = items
    .map((it) => {
      const m = titleMeta(it, site);
      return `<li><a href="${m.url}" style="color:#F2B544">${escapeHtml(m.nameFa || it.title)}${m.year ? ` (${escapeHtml(m.year)})` : ''}</a></li>`;
    })
    .join('');
  return `<main style="${SHELL_STYLE}"><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(intro)}</p>${links ? `<ul>${links}</ul>` : ''}</main>`;
}

function sitemapXml(entries) {
  const urls = entries
    .map((e) => `  <url><loc>${escapeHtml(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}${e.priority ? `<priority>${e.priority}</priority>` : ''}</url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

module.exports = { escapeHtml, jsonForScript, synopsisOf, persianNameOf, truncate, titleMeta, renderPage, titleBody, listBody, sitemapXml, SITE_NAME };
