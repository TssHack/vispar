const s = require('sharp'); const fs = require('fs');
const P = require('path').join(__dirname, '..', 'assets');
const icon = fs.readFileSync(P + '/brand/logo-icon.svg');
const markSrc = fs.readFileSync(P + '/brand/logo-mark.svg', 'utf8');
const markAt = (size, inner, mono) => {
  let m = markSrc;
  if (mono) m = m.replace(/url\(#vispar-amber\)/g, '#FFFFFF').replace(/#F7F3EA/g, '#FFFFFF');
  const pad = (size - inner) / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><g transform="translate(${pad},${pad}) scale(${inner / 100})">${m.replace(/<\/?svg[^>]*>/g, '')}</g></svg>`);
};
(async () => {
  await s(icon).resize(1024, 1024).png().toFile(P + '/icon.png');
  // Android adaptive: safe zone is the inner 66%
  await s(markAt(1024, 600)).png().toFile(P + '/android-icon-foreground.png');
  await s(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><defs><radialGradient id="bg" cx=".32" cy=".18" r=".95"><stop offset="0" stop-color="#33231A"/><stop offset=".55" stop-color="#120E13"/><stop offset="1" stop-color="#08080C"/></radialGradient></defs><rect width="1024" height="1024" fill="url(#bg)"/></svg>')).png().toFile(P + '/android-icon-background.png');
  await s(markAt(1024, 600, true)).png().toFile(P + '/android-icon-monochrome.png');
  await s(markAt(1024, 760)).png().toFile(P + '/splash-icon.png');
  const rounded = await s(icon).resize(192, 192).composite([{ input: Buffer.from('<svg width="192" height="192"><rect width="192" height="192" rx="44" fill="#fff"/></svg>'), blend: 'dest-in' }]).png().toBuffer();
  await s(rounded).resize(48, 48).png().toFile(P + '/favicon.png');
  // Android TV banner 320x180 (xhdpi), mark + Persian wordmark in Arad
  const banner = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
    <defs><radialGradient id="bg" cx=".25" cy=".2" r="1"><stop offset="0" stop-color="#33231A"/><stop offset=".55" stop-color="#120E13"/><stop offset="1" stop-color="#08080C"/></radialGradient></defs>
    <rect width="640" height="360" fill="url(#bg)"/>
    <g transform="translate(380,80) scale(2)">${markSrc.replace(/<\/?svg[^>]*>/g, '')}</g>
    <text x="350" y="212" text-anchor="end" font-family="Arad" font-weight="800" font-size="104" fill="#F4F1EA">ویسپار</text>
  </svg>`;
  await s(Buffer.from(banner)).resize(320, 180).png().toFile(P + '/tv-banner.png');
  await s(Buffer.from(banner)).png().toFile(P + '/brand/tv-banner@2x.png');
  // Logo lockup for README / store
  const lockup = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400">
    <rect width="1200" height="400" rx="48" fill="#08080C"/>
    <g transform="translate(740,50) scale(3)">${markSrc.replace(/<\/?svg[^>]*>/g, '')}</g>
    <text x="700" y="250" text-anchor="end" font-family="Arad" font-weight="800" font-size="150" fill="#F4F1EA">ویسپار</text>
  </svg>`;
  await s(Buffer.from(lockup)).png().toFile(P + '/brand/logo-lockup.png');
  console.log('done');
})();
