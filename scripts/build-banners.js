/**
 * Renders the social banners in docs/banners from the app screenshots.
 *   npm i --no-save puppeteer-core && CHROME=/usr/bin/google-chrome-stable node scripts/build-banners.js
 */
const puppeteer = require('puppeteer-core');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'banners');
const shot = (n) => 'file://' + path.join(ROOT, 'docs', 'screenshots', n);
const font = (n) => 'file://' + path.join(ROOT, 'assets', 'fonts', n);

const LOGO = `<svg viewBox="0 0 100 100" width="100%" height="100%"><defs><linearGradient id="g" x1=".15" y1=".1" x2=".85" y2=".95"><stop offset="0" stop-color="#FFE0A0"/><stop offset=".5" stop-color="#F2B544"/><stop offset="1" stop-color="#DB8520"/></linearGradient></defs><path d="M24 27 L50 73 L76 27" fill="none" stroke="url(#g)" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><path d="M43.5 31 L43.5 47 L57 39 Z" fill="#F7F3EA" stroke="#F7F3EA" stroke-width="3.2" stroke-linejoin="round"/></svg>`;

const BASE = `
@font-face{font-family:Arad;font-weight:400;src:url(${font('Arad-Regular.ttf')})}
@font-face{font-family:Arad;font-weight:600;src:url(${font('Arad-SemiBold.ttf')})}
@font-face{font-family:Arad;font-weight:800;src:url(${font('Arad-ExtraBold.ttf')})}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:#08080C;font-family:Arad,system-ui,sans-serif;color:#F4F1EA;direction:rtl}
.stage{position:relative;width:100%;height:100%;overflow:hidden;
 background:radial-gradient(120% 90% at 85% 15%,#3a2810 0%,#14100a 38%,#08080C 70%)}
.glow{position:absolute;border-radius:50%;filter:blur(60px);opacity:.55;background:radial-gradient(circle,#F2B544 0%,rgba(242,181,68,0) 70%)}
.grain{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px);background-size:26px 26px;opacity:.5}
.logo{display:flex;align-items:center;gap:.28em;font-weight:800}
.logo i{display:block;width:1.15em;height:1.15em}
.h1{font-weight:800;line-height:1.18;letter-spacing:-.01em}
.h1 em{font-style:normal;background:linear-gradient(120deg,#FFE0A0,#F2B544 55%,#E08A1E);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{color:#C9C5D3;line-height:1.7}
.chips{display:flex;flex-wrap:wrap;gap:.45em}
.chip{padding:.28em .8em;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);color:#E7E3EE;font-weight:600;white-space:nowrap}
.url{display:inline-flex;align-items:center;gap:.5em;padding:.45em 1em;border-radius:999px;background:linear-gradient(120deg,#FFD27A,#F2B544);color:#140E04;font-weight:800;direction:ltr}
.phone{position:absolute;border-radius:var(--r);overflow:hidden;border:calc(var(--r)*.07) solid #1c1c24;box-shadow:0 30px 70px rgba(0,0,0,.65),0 0 0 1px rgba(255,255,255,.12);background:#000}
.phone img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.screen{position:absolute;overflow:hidden;border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.14);background:#000}
.screen img{width:100%;height:100%;object-fit:cover;object-position:top left;display:block}
`;

const phone = (img, css, r) => `<div class="phone" style="--r:${r}px;${css}"><img src="${shot(img)}"></div>`;
const screen = (img, css) => `<div class="screen" style="${css}"><img src="${shot(img)}"></div>`;
const wrap = (inner) => `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>${BASE}</style></head><body><div class="stage"><div class="grain"></div>${inner}</div></body></html>`;

const PLATFORMS = ['اندروید', 'iOS', 'وب', 'Android TV', 'ویندوز', 'مک', 'لینوکس'];

const banners = {
  // LinkedIn profile cover. The avatar covers the bottom-left, so the visuals sit centre and text on the right.
  'linkedin-cover-1584x396': {
    w: 1584, h: 396,
    html: wrap(`
      <div class="glow" style="width:520px;height:520px;right:-60px;top:-200px"></div>
      <div class="glow" style="width:420px;height:420px;left:480px;bottom:-260px;opacity:.35"></div>
      ${screen('home-desktop.jpg', 'width:560px;height:340px;left:430px;top:56px;transform:perspective(1400px) rotateY(10deg) rotateZ(-1deg)')}
      ${phone('home-phone.jpg', 'width:132px;height:286px;left:400px;top:92px;transform:rotate(-6deg)', 22)}
      ${phone('detail-phone.jpg', 'width:132px;height:286px;left:260px;top:112px;transform:rotate(-12deg);opacity:.95', 22)}
      <div style="position:absolute;right:64px;top:50%;transform:translateY(-50%);width:520px">
        <div class="logo" style="font-size:44px;margin-bottom:14px"><i>${LOGO}</i><span>ویسپار</span></div>
        <div class="h1" style="font-size:40px">فیلم و سریال،<br><em>روی هر صفحه‌ای که دارید</em></div>
        <div class="chips" style="font-size:15px;margin-top:20px">${PLATFORMS.map((p) => `<span class="chip">${p}</span>`).join('')}</div>
      </div>
      <div class="url" style="position:absolute;right:64px;bottom:26px;font-size:17px">vispar.ehsanfazli.ir</div>`),
  },
  'linkedin-post-1200x627': {
    w: 1200, h: 627,
    html: wrap(`
      <div class="glow" style="width:640px;height:640px;left:-120px;top:-160px"></div>
      ${screen('home-desktop.jpg', 'width:660px;height:400px;left:36px;top:150px;transform:perspective(1600px) rotateY(12deg)')}
      ${phone('home-phone.jpg', 'width:170px;height:368px;left:420px;top:190px;transform:rotate(5deg)', 26)}
      ${phone('detail-phone.jpg', 'width:170px;height:368px;left:250px;top:230px;transform:rotate(-5deg)', 26)}
      <div style="position:absolute;right:48px;top:64px;width:500px">
        <div class="logo" style="font-size:40px;margin-bottom:18px"><i>${LOGO}</i><span>ویسپار</span></div>
        <div class="h1" style="font-size:50px">یک اپ،<br><em>همه‌ی صفحه‌ها</em></div>
        <div class="sub" style="font-size:20px;margin-top:14px">موبایل، تلویزیون، وب و دسکتاپ؛ سریع و زیبا.</div>
        <div class="chips" style="font-size:13px;margin-top:22px">${PLATFORMS.map((p) => `<span class="chip">${p}</span>`).join('')}</div>
      </div>
      <div class="url" style="position:absolute;right:56px;bottom:44px;font-size:21px">vispar.ehsanfazli.ir</div>`),
  },
  'instagram-square-1080x1080': {
    w: 1080, h: 1080,
    html: wrap(`
      <div class="glow" style="width:900px;height:900px;left:90px;top:-240px"></div>
      ${phone('splash.jpg', 'width:300px;height:650px;left:50px;top:520px;transform:rotate(-8deg)', 40)}
      ${phone('home-phone.jpg', 'width:360px;height:780px;left:290px;top:430px;z-index:2', 46)}
      ${phone('detail-phone.jpg', 'width:300px;height:650px;left:730px;top:520px;transform:rotate(8deg)', 40)}
      <div style="position:absolute;left:0;right:0;top:56px;text-align:center;z-index:5">
        <div class="logo" style="font-size:54px;justify-content:center;margin-bottom:12px"><i>${LOGO}</i><span>ویسپار</span></div>
        <div class="h1" style="font-size:62px">فیلم و سریال،<br><em>هر جا و هر دستگاه</em></div>
      </div>
      <div style="position:absolute;left:0;right:0;bottom:44px;display:flex;justify-content:center;z-index:3"><div class="url" style="font-size:28px">vispar.ehsanfazli.ir</div></div>`),
  },
  'instagram-story-1080x1920': {
    w: 1080, h: 1920,
    html: wrap(`
      <div class="glow" style="width:1100px;height:1100px;left:-10px;top:-100px"></div>
      <div class="glow" style="width:800px;height:800px;left:200px;bottom:-250px;opacity:.4"></div>
      <div style="position:absolute;left:0;right:0;top:210px;text-align:center;z-index:5">
        <div class="logo" style="font-size:78px;justify-content:center;margin-bottom:20px"><i>${LOGO}</i><span>ویسپار</span></div>
        <div class="h1" style="font-size:96px">فیلم و سریال<br><em>روی هر صفحه</em></div>
        <div class="sub" style="font-size:34px;margin-top:22px">اندروید · iOS · وب · تلویزیون · دسکتاپ</div>
      </div>
      ${phone('home-phone.jpg', 'width:470px;height:1018px;left:305px;top:760px;z-index:2', 62)}
      ${phone('detail-phone.jpg', 'width:380px;height:822px;left:-60px;top:930px;transform:rotate(-9deg)', 52)}
      ${phone('catalog-phone.jpg', 'width:380px;height:822px;left:760px;top:930px;transform:rotate(9deg)', 52)}
      <div style="position:absolute;left:0;right:0;bottom:170px;display:flex;justify-content:center;z-index:6"><div class="url" style="font-size:38px">vispar.ehsanfazli.ir</div></div>`),
  },
  'x-header-1500x500': {
    w: 1500, h: 500,
    html: wrap(`
      <div class="glow" style="width:640px;height:640px;left:100px;top:-220px"></div>
      ${screen('home-desktop.jpg', 'width:680px;height:410px;left:140px;top:70px;transform:perspective(1500px) rotateY(10deg)')}
      ${phone('home-phone.jpg', 'width:160px;height:346px;left:90px;top:120px;transform:rotate(-7deg)', 26)}
      ${phone('detail-phone.jpg', 'width:160px;height:346px;left:760px;top:130px;transform:rotate(7deg)', 26)}
      <div style="position:absolute;right:70px;top:50%;transform:translateY(-50%);width:520px">
        <div class="logo" style="font-size:50px;margin-bottom:16px"><i>${LOGO}</i><span>ویسپار</span></div>
        <div class="h1" style="font-size:48px">فیلم و سریال،<br><em>روی هر صفحه</em></div>
        <div class="url" style="font-size:22px;margin-top:22px">vispar.ehsanfazli.ir</div>
      </div>`),
  },
};

(async () => {
  const only = process.argv[2];
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, b] of Object.entries(banners)) {
    if (only && !name.includes(only)) continue;
    const page = await browser.newPage();
    await page.setViewport({ width: b.w, height: b.h, deviceScaleFactor: 1 });
    const file = path.join(OUT, `${name}.html`);
    fs.writeFileSync(file, b.html);
    await page.goto('file://' + file, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    fs.unlinkSync(file);
    console.log('rendered', name);
    await page.close();
  }
  await browser.close();
})();
