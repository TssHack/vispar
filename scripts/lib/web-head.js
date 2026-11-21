// Pure helpers for the head of dist/index.html (used by scripts/pwa-postbuild.js and unit tested).

const SITE_URL_DEFAULT = 'https://vispar.ehsanfazli.ir';

const TITLE = 'ویسپار';
const DESCRIPTION = 'ویسپار؛ تماشای فیلم و سریال روی موبایل، تلویزیون و کامپیوتر';

/** Search engine verification tokens, from the build environment (#62). Only safe token characters. */
function verificationTags(env) {
  const ok = (v) => (typeof v === 'string' && /^[A-Za-z0-9_\-.:=+]{6,128}$/.test(v.trim()) ? v.trim() : '');
  const google = ok(env.GOOGLE_SITE_VERIFICATION);
  const bing = ok(env.BING_SITE_VERIFICATION);
  return [
    ...(google ? [{ key: /name="google-site-verification"/, tag: `<meta name="google-site-verification" content="${google}" />` }] : []),
    ...(bing ? [{ key: /name="msvalidate\.01"/, tag: `<meta name="msvalidate.01" content="${bing}" />` }] : []),
  ];
}

/** Tags to add when missing. `key` is a regex that detects an existing equivalent. */
function headTags(site, env = {}) {
  return [
    ...verificationTags(env),
    { key: /rel="manifest"/, tag: '<link rel="manifest" href="/manifest.webmanifest" />' },
    { key: /rel="icon"[^>]*sizes="32x32"|favicon-32/, tag: '<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />' },
    { key: /rel="apple-touch-icon"/, tag: '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />' },
    { key: /name="theme-color"/, tag: '<meta name="theme-color" content="#08080C" />' },
    { key: /name="mobile-web-app-capable"/, tag: '<meta name="mobile-web-app-capable" content="yes" />' },
    { key: /name="apple-mobile-web-app-capable"/, tag: '<meta name="apple-mobile-web-app-capable" content="yes" />' },
    { key: /name="apple-mobile-web-app-title"/, tag: `<meta name="apple-mobile-web-app-title" content="${TITLE}" />` },
    { key: /name="apple-mobile-web-app-status-bar-style"/, tag: '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />' },
    { key: /name="description"/, tag: `<meta name="description" content="${DESCRIPTION}" />` },
    { key: /rel="canonical"/, tag: `<link rel="canonical" href="${site}/" />` },
    { key: /property="og:type"/, tag: '<meta property="og:type" content="website" />' },
    { key: /property="og:site_name"/, tag: `<meta property="og:site_name" content="${TITLE}" />` },
    { key: /property="og:locale"/, tag: '<meta property="og:locale" content="fa_IR" />' },
    { key: /property="og:title"/, tag: `<meta property="og:title" content="${TITLE} | فیلم و سریال، روی هر صفحه" />` },
    { key: /property="og:description"/, tag: `<meta property="og:description" content="${DESCRIPTION}" />` },
    { key: /property="og:url"/, tag: `<meta property="og:url" content="${site}/" />` },
    { key: /property="og:image"(?!:)/, tag: `<meta property="og:image" content="${site}/og.png" />` },
    { key: /property="og:image:width"/, tag: '<meta property="og:image:width" content="1200" />' },
    { key: /property="og:image:height"/, tag: '<meta property="og:image:height" content="630" />' },
    { key: /name="twitter:card"/, tag: '<meta name="twitter:card" content="summary_large_image" />' },
    { key: /name="twitter:title"/, tag: `<meta name="twitter:title" content="${TITLE} | فیلم و سریال، روی هر صفحه" />` },
    { key: /name="twitter:description"/, tag: `<meta name="twitter:description" content="${DESCRIPTION}" />` },
    { key: /name="twitter:image"/, tag: `<meta name="twitter:image" content="${site}/og.png" />` },
  ];
}

/** Adds the PWA, social and direction tags that are not there yet. Running it twice changes nothing. */
function injectHead(html, { site = SITE_URL_DEFAULT, env = {} } = {}) {
  const origin = site.replace(/\/+$/, '');
  let out = html;

  // The app is right-to-left from the first byte, not only once its styles run.
  out = out.replace(/<html([^>]*)>/i, (m, attrs) => {
    let a = attrs;
    if (!/\blang=/.test(a)) a += ' lang="fa"';
    if (!/\bdir=/.test(a)) a += ' dir="rtl"';
    return `<html${a}>`;
  });

  const missing = headTags(origin, env).filter((t) => !t.key.test(out)).map((t) => `    ${t.tag}`);
  if (missing.length) out = out.replace('</head>', `${missing.join('\n')}\n  </head>`);

  // iOS needs viewport-fit=cover for the notch / home indicator safe areas.
  out = out.replace(/(<meta name="viewport" content="[^"]*?)"/, (m, a) => (a.includes('viewport-fit') ? m : `${a}, viewport-fit=cover"`));
  return out;
}

module.exports = { injectHead, verificationTags, SITE_URL_DEFAULT };
