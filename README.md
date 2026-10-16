<p align="center"><img src="assets/brand/logo-lockup.png" alt="ویسپار" width="480"></p>

# ویسپار

اپ فیلم و سریال برای **اندروید، iOS، وب و Android TV** از یک کدبیس، با Expo و React Native.

طراحی و توسعه: **احسان فضلی** · [ehsanjs.ir](https://ehsanjs.ir)

## امکانات

**تماشا**
- پلیر اختصاصی با نوار پیشرفت، جلو و عقب (۱۰، ۱۵ یا ۳۰ ثانیه)، دوبار ضربه برای پرش، سرعت پخش، تغییر کیفیت حین پخش و تمام‌صفحه با چرخش خودکار
- ادامه از جای قبلی و پخش خودکار قسمت بعد با شمارش معکوس
- پخش در پس‌زمینه و تصویر در تصویر (PiP)
- میانبرهای کیبورد روی وب: فاصله، ← →، ↑ ↓، F، M، N
- **پلیرهای خارجی:** VLC، MX Player، mpv، Just Player، Kodi، KMPlayer، XPlayer، nPlayer، Infuse و Outplayer. روی اندروید برنامه‌های نصب‌شده با آیکن‌شان اول لیست می‌آیند. روی وب یک پلی‌لیست ‎.m3u ساخته می‌شود که با VLC یا PotPlayer باز می‌شود.
- **دانلودرها:** ADM، 1DM، 1DM+‎، FDM، مدیر دانلود سیستم، اشتراک‌گذاری و کپی لینک (برای IDM و JDownloader)

**کشف و مرور**
- خانه با اسلایدر، ادامه‌ی تماشا، لیست من، تازه‌ترین‌ها، برترین‌ها از نظر IMDb و ردیف ژانرها
- فیلتر چندگانه: ژانر، دهه، کشور، حداقل امتیاز IMDb و کیفیت موجود
- مرتب‌سازی: تازه‌ترین، امتیاز، سال و الفبا
- جستجو با فیلتر فیلم و سریال
- فیلم‌ها و سریال‌های مشابه در صفحه‌ی جزئیات
- **کتابخانه:** لیست من، ادامه‌ی تماشا و تاریخچه

**شخصی‌سازی**
- تم سیستم، روشن یا تیره
- پنج رنگ اصلی
- اندازه‌ی پوسترها
- ارقام فارسی یا انگلیسی
- کاهش حرکت و انیمیشن
- نمایش یا پنهان کردن امتیاز روی پوسترها
- انتخاب بخش‌های صفحه‌ی خانه
- کیفیت پیش‌فرض، پلیر و دانلودر پیش‌فرض

**پلتفرم‌ها**
- ریسپانسیو: گوشی، تبلت، دسکتاپ و Android TV با منوی کناری و فوکوس ریموت
- راست‌به‌چپ کامل با فونت **عراد**
- **به‌روزرسانی:** بررسی ریلیزهای گیت‌هاب برای APK جدید، به‌علاوه‌ی OTA با `expo-updates`

## اجرا

```bash
npm install
cp .env.example .env        # آدرس API یا پراکسی
npm run web                 # وب
npm run android             # اندروید (نیاز به development build دارد)
```

پیش‌نمایش ظاهر تلویزیون در مرورگر: `http://localhost:8081/?tv=1`

## دسترسی به API

API کلید را داخل آدرس می‌گیرد و هدر CORS ندارد. دو سرور پراکسی در پروژه هست که هر دو کار یکسانی می‌کنند؛ اپ فرقی بینشان نمی‌بیند، پس هرکدام را خواستید اجرا کنید.

**۱. Node.js (پیشنهادی، بدون وابستگی):**

```bash
cp server/.env.example server/.env   # و VISPAR_API_KEY را بگذارید
npm run server                       # روی پورت 8787
```

مستقل از هر سرویسی اجرا می‌شود، هیچ پکیجی نصب نمی‌کند و کلید را سمت سرور نگه می‌دارد. جزئیات در `server/README.md`.

**۲. Cloudflare Worker (`proxy/`):**

- کلید را سمت سرور نگه می‌دارد،
- هدر CORS را برای نسخه‌ی وب اضافه می‌کند،
- فقط چهار مسیر فقط‌خواندنی اپ را عبور می‌دهد و پاسخ‌ها را کوتاه‌مدت کش می‌کند.

```bash
cd proxy
npm install
npx wrangler secret put VISPAR_API_KEY
npm run deploy
```

هر دو سرور فقط چهار مسیر زیر را عبور می‌دهند و بقیه را پیش از هر تماس با API رد می‌کنند:
`movie/by/filtres/0/created/{page}`، `serie/by/filtres/0/created/{page}`، `season/by/serie/{id}` و `search/{query}`.

بعد در `.env` بنویسید: `EXPO_PUBLIC_API_BASE=https://vispar-api.<subdomain>.workers.dev` یا `http://localhost:8787`.

حالت مستقیم (بدون پراکسی، فقط موبایل) هم با `EXPO_PUBLIC_API_KEY` کار می‌کند. در این حالت کلید داخل اپ قرار می‌گیرد، مثل نسخه‌ی فعلی اندروید — یعنی هر کسی که APK را باز کند می‌تواند کلید را ببیند؛ برای نسخه‌ی عمومی از یکی از دو پراکسی بالا استفاده کنید.

## انتشار نسخه‌ی جدید

1. `version` را در `app.json` بالا ببرید (مثلاً `2.1.0`).
2. APK بسازید: `npx eas-cli build -p android --profile production`
3. در گیت‌هاب یک Release با تگ `v2.1.0` بسازید و فایل `.apk` را پیوست کنید. توضیحات Release همان «تغییرات این نسخه» است که در اپ نمایش داده می‌شود.

اپ‌های نصب‌شده در اجرای بعدی (حداکثر هر ۱۲ ساعت یک‌بار) یا با دکمه‌ی «بررسی به‌روزرسانی» در تنظیمات نسخه‌ی جدید را می‌بینند.

برای تغییرات فقط JS، به‌جای APK می‌توانید OTA بفرستید: یک‌بار `npx eas-cli init` و `npx eas-cli update:configure`، بعد `npx eas-cli update --channel production`.

## Android TV

ساخت نسخه‌ی تلویزیون از همین پروژه:

```bash
npm run prebuild:tv          # EXPO_TV=1 expo prebuild --clean
npx expo run:android         # روی امولاتور Android TV
# یا با EAS:
npx eas-cli build -p android --profile production_tv
```

Expo نسخه‌ی تلویزیون را با فورک [`react-native-tvos`](https://github.com/react-native-tvos/react-native-tvos) می‌سازد. این پروژه روی Expo SDK 58 (React Native 0.88) است و هنگام نوشتن این متن، نسخه‌ی پایدار 0.88 آن هنوز منتشر نشده بود (فقط RC). وقتی منتشر شد:

```json
"react-native": "npm:react-native-tvos@0.88-stable"
```

کدهای رابط تلویزیون (منوی کناری، فوکوس، بنر) آماده‌اند و با همان فورک کار می‌کنند.

## ساختار

```
src/app/          صفحه‌ها (expo-router)
src/api/          کلاینت، پارسرها، هوک‌های react-query
src/components/   کامپوننت‌ها
src/theme/        توکن‌ها، فونت، ThemeProvider
src/update/       سیستم به‌روزرسانی
src/player/       کنترل‌های پلیر
src/external/     پلیرها و دانلودرهای خارجی
src/filters/      فیلتر و مرتب‌سازی
src/library/      لیست من، ادامه‌ی تماشا، تاریخچه
src/settings/     تنظیمات کاربر
plugins/          پلاگین اندروید برای شناسایی برنامه‌های نصب‌شده
proxy/            پراکسی Cloudflare Worker
server/           پراکسی Node.js (بدون وابستگی)
assets/brand/     لوگو (SVG)، بنر تلویزیون، لاک‌آپ
scripts/          ساخت آیکن‌ها و برش وزن‌های فونت
tests/            تست‌ها (vitest)
```

## دستورها

| دستور | کار |
| --- | --- |
| `npm run typecheck` | بررسی تایپ اپ و سرور |
| `npm test` | تست‌های اپ |
| `npm run test:server` | تست‌های سرور Node |
| `npm run server` | اجرای پراکسی Node |
| `npm run server:check` | بررسی تایپ سرور |
| `npm run build:web` | خروجی وب در `dist/` |
| `npm run brand:icons` | ساخت دوباره‌ی آیکن‌ها از SVG لوگو |
| `python3 scripts/build-fonts.py` | ساخت وزن‌های ثابت از `Arad-VF.ttf` |

## فونت

فونت عراد تحت مجوز SIL Open Font License 1.1 است. فایل متغیر اصلی در `assets/fonts/Arad-VF.ttf` است و وزن‌های ثابت (۴۰۰ تا ۸۰۰) از روی آن ساخته شده‌اند، چون اندروید وزن را از فونت متغیر انتخاب نمی‌کند.
