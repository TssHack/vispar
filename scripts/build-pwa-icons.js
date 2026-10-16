// Builds the PWA / store icons in public/icons from assets/icon.png.
const sharp = require('sharp');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'assets', 'icon.png');
const OUT = path.join(__dirname, '..', 'public', 'icons');
const BG = '#08080C';

async function plain(size, name) {
  await sharp(SRC).resize(size, size).png().toFile(path.join(OUT, name));
}

/** Maskable icons need the artwork inside the central 80% safe zone. */
async function maskable(size, name) {
  const inner = Math.round(size * 0.74);
  const art = await sharp(SRC).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: art, gravity: 'center' }])
    .png()
    .toFile(path.join(OUT, name));
}

(async () => {
  await plain(192, 'icon-192.png');
  await plain(512, 'icon-512.png');
  await maskable(512, 'maskable-512.png');
  await maskable(180, 'apple-touch-icon.png');
  await plain(32, 'favicon-32.png');
  console.log('PWA icons written to public/icons');
})();
