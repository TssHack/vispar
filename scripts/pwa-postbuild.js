// Adds PWA / iOS home-screen tags to dist/index.html after `expo export -p web`.
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'dist', 'index.html');
if (!fs.existsSync(file)) {
  console.error('dist/index.html not found; run `expo export -p web` first');
  process.exit(1);
}

const tags = `
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <meta name="theme-color" content="#08080C" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="ویسپار" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="description" content="ویسپار؛ تماشای فیلم و سریال روی موبایل، تلویزیون و کامپیوتر" />`;

let html = fs.readFileSync(file, 'utf8');
if (!html.includes('rel="manifest"')) {
  html = html.replace('</head>', `${tags}\n  </head>`);
  // iOS needs viewport-fit=cover for the notch / home indicator safe areas.
  html = html.replace(/(<meta name="viewport" content="[^"]*?)"/, (m, a) => (a.includes('viewport-fit') ? m : `${a}, viewport-fit=cover"`));
  fs.writeFileSync(file, html);
  console.log('PWA tags injected into dist/index.html');
}
