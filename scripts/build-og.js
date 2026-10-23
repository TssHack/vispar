// Builds public/og.png (1200x630, the social preview) from the LinkedIn post banner.
const sharp = require('sharp');
const path = require('node:path');

const src = path.join(__dirname, '..', 'docs', 'banners', 'linkedin-post-1200x627.png');
const out = path.join(__dirname, '..', 'public', 'og.png');
sharp(src)
  .resize(1200, 630, { fit: 'cover', position: 'top' })
  .png({ compressionLevel: 9 })
  .toFile(out)
  .then(() => console.log('wrote', out));
