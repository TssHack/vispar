// Adds PWA, social-preview and direction tags to dist/index.html after `expo export -p web`.
const fs = require('node:fs');
const path = require('node:path');

const { injectHead, SITE_URL_DEFAULT } = require('./lib/web-head');

const file = path.join(__dirname, '..', 'dist', 'index.html');
if (!fs.existsSync(file)) {
  console.error('dist/index.html not found; run `expo export -p web` first');
  process.exit(1);
}

const before = fs.readFileSync(file, 'utf8');
const after = injectHead(before, { site: process.env.SITE_URL || SITE_URL_DEFAULT });
if (after !== before) {
  fs.writeFileSync(file, after);
  console.log('PWA and social tags injected into dist/index.html');
}
