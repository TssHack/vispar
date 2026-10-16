/** Plain functions only (no React Native imports) so they can be unit tested. */

export type PlaybackHint = { title: string; body: string };

/** Turns a raw player error into something a person can act on. The raw text is still shown below it. */
export function explainPlaybackError(message: string | undefined | null): PlaybackHint {
  const m = (message ?? '').toLowerCase();
  if (m.includes('cleartext')) return { title: 'اتصال HTTP مسدود است', body: 'این نسخه‌ی برنامه اجازه‌ی اتصال HTTP را ندارد. آخرین نسخه را نصب کنید.' };
  if (/timeout|timed out|unable to connect|unknownhost|unresolved|connect/.test(m)) return { title: 'به سرور فایل نرسیدیم', body: 'سرور فایل جواب نمی‌دهد یا از شبکه‌ی شما در دسترس نیست (فیلترینگ، VPN یا قطعی). اینترنت و VPN را بررسی کنید یا کیفیت دیگری را امتحان کنید.' };
  if (/response code: 40[13]|403|401/.test(m)) return { title: 'سرور اجازه‌ی دسترسی نداد', body: 'سرور فایل این درخواست را رد کرد. با پلیر دیگر یا دانلودر امتحان کنید.' };
  if (/response code: 404|404/.test(m)) return { title: 'فایل روی سرور پیدا نشد', body: 'لینک این کیفیت دیگر معتبر نیست. کیفیت دیگری را امتحان کنید.' };
  if (/decoder|codec|format|unsupported|exceeds/.test(m)) return { title: 'قالب یا کدک پشتیبانی نمی‌شود', body: 'دستگاه نمی‌تواند این کدک (مثلاً HEVC یا DTS) را پخش کند. با VLC یا MX Player پخش کنید.' };
  return { title: 'پخش این فایل ممکن نشد', body: 'کیفیت دیگری را امتحان کنید یا با پلیر دیگر پخش کنید.' };
}
