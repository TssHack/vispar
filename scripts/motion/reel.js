// Frame-by-frame renderer for the Vispar reel (1080x1920, 15 s, 30 fps).
//   npm i --no-save puppeteer-core
//   python3 music.py music.wav && node reel.js music.wav ../../docs/motion/vispar-reel.mp4
const puppeteer = require('puppeteer-core');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const W = 1080, H = 1920, FPS = 30, DUR = 15;
const shot = (n) => 'file://' + path.join(ROOT, 'docs', 'screenshots', n);
const font = (n) => 'file://' + path.join(ROOT, 'assets', 'fonts', n);

const LOGO = (id) => `<svg viewBox="0 0 100 100" width="100%" height="100%" style="overflow:visible"><defs><linearGradient id="${id}" x1=".15" y1=".1" x2=".85" y2=".95"><stop offset="0" stop-color="#FFE0A0"/><stop offset=".5" stop-color="#F2B544"/><stop offset="1" stop-color="#DB8520"/></linearGradient></defs><path class="vpath" d="M24 27 L50 73 L76 27" fill="none" stroke="url(#${id})" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="106" stroke-dashoffset="106"/><path class="vplay" d="M43.5 31 L43.5 47 L57 39 Z" fill="#F7F3EA" stroke="#F7F3EA" stroke-width="3.2" stroke-linejoin="round" style="transform-origin:50px 39px;transform:scale(0)"/></svg>`;
const GITHUB = `<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="#F4F1EA" d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.38 7.86 10.9.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.34.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>`;
const STAR = `<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="#F2B544" d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"/></svg>`;

const PLATFORMS = ['اندروید', 'iOS', 'وب', 'Android TV', 'ویندوز', 'مک', 'لینوکس'];

const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:Arad;font-weight:400;src:url(${font('Arad-Regular.ttf')})}
@font-face{font-family:Arad;font-weight:700;src:url(${font('Arad-Bold.ttf')})}
@font-face{font-family:Arad;font-weight:800;src:url(${font('Arad-ExtraBold.ttf')})}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#08080C;font-family:Arad,sans-serif;color:#F4F1EA}
.abs{position:absolute}
.stage{position:absolute;inset:0;overflow:hidden;background:radial-gradient(120% 80% at 50% 25%,#2e2010 0%,#120d08 45%,#08080C 78%)}
.glow{position:absolute;border-radius:50%;background:radial-gradient(circle,rgba(242,181,68,.55) 0%,rgba(242,181,68,0) 68%);filter:blur(30px)}
.grain{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.055) 1px,transparent 1px);background-size:30px 30px}
.centre{position:absolute;left:0;right:0;text-align:center}
.grad{background:linear-gradient(120deg,#FFE0A0,#F2B544 55%,#E08A1E);-webkit-background-clip:text;background-clip:text;color:transparent}
.phone{position:absolute;border-radius:60px;overflow:hidden;border:9px solid #1c1c24;box-shadow:0 40px 90px rgba(0,0,0,.7),0 0 0 1.5px rgba(255,255,255,.14);background:#000}
.phone img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.chip{position:absolute;left:50%;padding:.3em 1.1em;border-radius:999px;font-weight:700;font-size:58px;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.18);white-space:nowrap}
.pill{display:inline-block;padding:.35em 1em;border-radius:999px;background:linear-gradient(120deg,#FFD27A,#F2B544);color:#140E04;font-weight:800;direction:ltr}
.mono{direction:ltr;font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:700}
</style></head><body><div class="stage" id="stage">
 <div class="glow" id="g1" style="width:1300px;height:1300px"></div>
 <div class="glow" id="g2" style="width:900px;height:900px;opacity:.45"></div>
 <div class="grain"></div>

 <div class="abs" id="logo" style="width:300px;height:300px">${LOGO('lg1')}</div>
 <div class="centre" id="name" style="font-size:110px;font-weight:800">ویسپار</div>

 <div class="centre" id="h1" style="font-size:112px;font-weight:800;line-height:1.2">
   <div id="h1a" style="overflow:hidden;height:150px"><div>فیلم و سریال،</div></div>
   <div id="h1b" style="overflow:hidden;height:150px"><div class="grad">روی هر صفحه</div></div>
 </div>
 <div class="phone" id="p1" style="width:340px;height:736px"><img src="${shot('detail-phone.jpg')}"></div>
 <div class="phone" id="p2" style="width:420px;height:910px;z-index:2"><img src="${shot('home-phone.jpg')}"></div>
 <div class="phone" id="p3" style="width:340px;height:736px"><img src="${shot('catalog-phone.jpg')}"></div>

 <div class="centre" id="s3t" style="font-size:84px;font-weight:800">یک اپ، همه‌ی دستگاه‌ها</div>
 ${PLATFORMS.map((p, i) => `<div class="chip" id="chip${i}">${p}</div>`).join('')}

 <div class="abs" id="gh" style="width:210px;height:210px">${GITHUB}</div>
 <div class="centre" id="os1" style="font-size:150px;font-weight:800">متن‌باز</div>
 <div class="centre mono" id="os2" style="font-size:54px;color:#C9C5D3;letter-spacing:.06em">OPEN SOURCE</div>
 <div class="centre" id="os3" style="font-size:44px"><span class="pill mono" style="font-size:44px">github.com/TssHack/vispar</span></div>
 <div class="abs" id="star" style="width:120px;height:120px">${STAR}</div>
 <div class="centre" id="os4" style="font-size:42px;color:#C9C5D3">Expo · React Native · TypeScript</div>

 <div class="abs" id="logo2" style="width:240px;height:240px">${LOGO('lg2')}</div>
 <div class="centre" id="c1" style="font-size:100px;font-weight:800;line-height:1.25">همین حالا<br><span class="grad">امتحانش کنید</span></div>
 <div class="centre" id="c2" style="font-size:60px"><span class="pill" style="font-size:60px">vispar.ehsanfazli.ir</span></div>
 <div class="centre" id="c3" style="font-size:40px;color:#C9C5D3">اندروید · iOS · وب · تلویزیون · دسکتاپ</div>
 <div class="abs" id="fade" style="inset:0;background:#08080C;opacity:0"></div>
</div>
<script>
const $=id=>document.getElementById(id);
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const prog=(t,a,b)=>clamp((t-a)/(b-a));
const oc=x=>1-Math.pow(1-x,3);
const ob=x=>{const c=1.70158,d=c+1;return 1+d*Math.pow(x-1,3)+c*Math.pow(x-1,2)};
const io=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
const W=${W},H=${H};
function place(el,{x=W/2,y=0,s=1,r=0,o=1,cx=true}){el.style.opacity=o;el.style.transform='translate('+(cx?'-50%':'0')+',0) translate('+(x-(cx?W/2:0))+'px,'+y+'px) scale('+s+') rotate('+r+'deg)'; }
function set(el,left,top,{s=1,r=0,o=1}={}){el.style.left=left+'px';el.style.top=top+'px';el.style.opacity=o;el.style.transformOrigin='50% 50%';el.style.transform='scale('+s+') rotate('+r+'deg)'}
function text(el,top,{o=1,y=0,s=1}={}){el.style.top=top+'px';el.style.opacity=o;el.style.transform='translateY('+y+'px) scale('+s+')'}
window.render=function(t){
 // ambient light
 const g1=$('g1'),g2=$('g2');
 g1.style.left=(-110+Math.sin(t*.5)*60)+'px';g1.style.top=(120+Math.cos(t*.4)*50)+'px';g1.style.opacity=.35+.35*prog(t,0,1.6);
 g2.style.left=(400+Math.cos(t*.45)*70)+'px';g2.style.top=(1100+Math.sin(t*.5)*60)+'px';
 const sceneMix=[[2.1,6.0],[6.0,9.0],[9.0,12.0]];

 // ---------- S1: logo draws (0-2s), then moves up with the name ----------
 const draw=oc(prog(t,0.25,1.55));
 document.querySelector('#logo .vpath').style.strokeDashoffset=106*(1-draw);
 const pop=ob(prog(t,1.55,2.0));
 document.querySelector('#logo .vplay').style.transform='scale('+pop+')';
 const toTop=io(prog(t,2.0,2.7)), out1=prog(t,5.6,6.0);
 const logoS=1-.45*toTop, logoY=760+(170-760)*toTop-out1*300;
 set($('logo'),W/2-150,logoY-150+0,{s:logoS,o:(1-out1)*prog(t,0.1,0.4)});
 text($('name'),logoY+110*logoS+20,{o:ob(prog(t,1.9,2.5))>0?clamp(prog(t,1.9,2.3))*(1-out1):0,y:20*(1-oc(prog(t,1.9,2.5)))-out1*300,s:1-.35*toTop});

 // ---------- S2: headline + phones (2.1-6.0) ----------
 const h1y=oc(prog(t,2.5,3.1)), h1b=oc(prog(t,2.95,3.55)), outH=io(prog(t,5.55,6.0));
 text($('h1'),430-outH*260,{o:1-outH});
 $('h1a').firstChild.style.transform='translateY('+(150*(1-h1y))+'px)';
 $('h1b').firstChild.style.transform='translateY('+(150*(1-h1b))+'px)';
 const ph=(i,delay)=>oc(prog(t,2.9+delay,3.9+delay));
 const bob=Math.sin(t*1.6)*8;
 const outP=io(prog(t,5.55,6.0));
 set($('p2'),W/2-210,860+(1100)*(1-ph(0,0.0))+bob+outP*1100,{s:1,r:0});
 set($('p1'),150-60,1020+(1000)*(1-ph(1,0.15))-bob+outP*1100,{s:1,r:-8});
 set($('p3'),W-340-150+60,1020+(1000)*(1-ph(2,0.3))+bob+outP*1100,{s:1,r:8});

 // ---------- S3: platforms (6.0-9.0) ----------
 const in3=oc(prog(t,6.0,6.5)), out3=io(prog(t,8.65,9.0));
 text($('s3t'),340,{o:in3*(1-out3),y:(1-in3)*60-out3*200});
 PLATFORMS=${JSON.stringify(PLATFORMS)};
 const cols=[ [0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[1,2] ];
 for(let i=0;i<7;i++){
   const p=ob(prog(t,6.25+i*.24,6.7+i*.24));
   const row=Math.floor(i/1);
   const y=560+i*150; const x=W/2+((i%2)?-130:130);
   const el=$('chip'+i);
   el.style.top=y+'px';el.style.opacity=clamp(p*2)*(1-out3);
   el.style.transform='translate(-50%,0) translateX('+(x-W/2)+'px) translateY('+(-out3*200)+'px) scale('+(0.4+0.6*Math.min(1,p))+')';
   el.style.borderColor=(t>6.25+i*.24&&t<6.7+i*.24)?'#F2B544':'rgba(255,255,255,.18)';
 }

 // ---------- S4: open source (9.0-12.0) ----------
 const in4=oc(prog(t,9.0,9.6)), out4=io(prog(t,11.65,12.0));
 const ghS=ob(prog(t,9.0,9.7));
 set($('gh'),W/2-105,470-out4*200,{s:ghS*(1-out4*.2),o:clamp(ghS)*(1-out4)});
 text($('os1'),700-out4*200,{o:oc(prog(t,9.25,9.8))*(1-out4),y:(1-oc(prog(t,9.25,9.8)))*80,s:1});
 text($('os2'),905-out4*200,{o:oc(prog(t,9.55,10.0))*(1-out4),y:(1-oc(prog(t,9.55,10.0)))*40});
 text($('os3'),1090-out4*200,{o:oc(prog(t,9.85,10.3))*(1-out4),y:(1-oc(prog(t,9.85,10.3)))*40});
 const starIn=ob(prog(t,10.4,11.0));
 set($('star'),W/2-60,1290-out4*200,{s:starIn*(1+.12*Math.sin((t-10.4)*9)*(t>11?0:1)),r:(1-starIn)*-180+0,o:clamp(starIn)*(1-out4)});
 text($('os4'),1480-out4*200,{o:oc(prog(t,10.7,11.2))*(1-out4)});

 // ---------- S5: call to action (12.0-15.0) ----------
 const in5=oc(prog(t,12.0,12.6));
 const l2=ob(prog(t,12.0,12.7));
 set($('logo2'),W/2-120,330,{s:l2,o:clamp(l2)});
 document.querySelector('#logo2 .vpath').style.strokeDashoffset=0;
 document.querySelector('#logo2 .vplay').style.transform='scale(1)';
 text($('c1'),640,{o:oc(prog(t,12.3,12.9)),y:(1-oc(prog(t,12.3,12.9)))*70});
 const pulse=1+.04*Math.sin(Math.max(0,t-13)*7);
 text($('c2'),1010,{o:oc(prog(t,12.8,13.3)),y:(1-oc(prog(t,12.8,13.3)))*50,s:pulse});
 text($('c3'),1200,{o:oc(prog(t,13.1,13.6))});
 $('fade').style.opacity=prog(t,14.4,15.0);
 // hide settled scene elements cleanly
 for(const id of ['logo','name']) if(t>6.05) $(id).style.opacity=0;
}
</script></body></html>`;

(async () => {
  const [wav, outFile] = [process.argv[2], process.argv[3]];
  const tmp = path.join(__dirname, '.frames');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const file = path.join(tmp, 'reel.html');
  fs.writeFileSync(file, html);
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto('file://' + file, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  const only = process.env.ONLY_T ? Number(process.env.ONLY_T) : null;
  const frames = Math.round(DUR * FPS);
  for (let f = 0; f < frames; f++) {
    const t = f / FPS;
    if (only !== null && Math.abs(t - only) > 1e-6) continue;
    await page.evaluate((tt) => window.render(tt), t);
    await page.screenshot({ path: path.join(tmp, `f${String(f).padStart(4, '0')}.png`) });
    if (f % 60 === 0) console.log('frame', f, '/', frames);
  }
  await browser.close();
  if (only !== null) return;
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(tmp, 'f%04d.png'), '-i', wav, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'slow', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outFile], { stdio: 'inherit' });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('wrote', outFile);
})();
