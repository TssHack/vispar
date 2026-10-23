const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

let digitStyle: 'fa' | 'en' = 'fa';
/** Set from the user's settings; Latin digits are an accessibility/preference option. */
export function setDigitStyle(style: 'fa' | 'en') {
  digitStyle = style;
}

/** Converts ASCII digits to Persian digits and "." to the Persian decimal separator. */
export function faNum(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (digitStyle === 'en') return s.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));
  return s.replace(/(\d)\.(\d)/g, '$1٫$2').replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** Version like 2.0.0 → "۲.۰.۰" (keeps dots, unlike faNum). */
export function faVersion(v: string): string {
  const s = v.replace(/^v/i, '');
  return digitStyle === 'en' ? s : s.replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** Seconds → "۱:۰۲:۰۵" or "۰۴:۰۹". */
export function faClock(totalSeconds: number): string {
  const t = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return faNum(h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`);
}

/** IMDb / site score like 8.1 → "۸٫۱". Returns '' for 0 or invalid values. */
export function faScore(score: number | null | undefined): string {
  if (!score || !Number.isFinite(score) || score <= 0) return '';
  return faNum(score.toFixed(1));
}

/** Year, hiding the API's 0 default. */
export function faYear(year: number | null | undefined): string {
  return year && year > 0 ? faNum(year) : '';
}

/** Joins non-empty parts with a middle dot. */
export function joinMeta(...parts: (string | null | undefined | false)[]): string {
  return parts.filter(Boolean).join(' · ');
}

/** Quality labels such as "1080p" stay Latin; maps them to a short Persian description. */
export function qualityLabel(quality: string): string {
  const q = quality.toLowerCase();
  if (q.includes('2160') || q.includes('4k')) return 'Ultra HD';
  if (q.includes('1080')) return 'Full HD';
  if (q.includes('720')) return 'HD';
  if (q.includes('480') || q.includes('360')) return 'کم‌حجم';
  return quality || 'نامشخص';
}

/**
 * A label short enough for a button or badge: "1080 زیرنویس" -> "1080p", "720x265 زیرنویس" -> "720p",
 * "4K" -> "2160p". Qualities without a resolution (e.g. "تیزر") keep their text; empty stays empty.
 * The full catalogue text belongs where there is room for it (source list, quality menu).
 */
export function shortQuality(quality: string | null | undefined): string {
  const q = (quality ?? '').trim();
  if (!q) return '';
  const rank = qualityRank(q);
  return rank > 0 ? `${rank}p` : q;
}

/** Sort key so higher resolutions come first. */
export function qualityRank(quality: string): number {
  const m = quality.match(/(\d{3,4})/);
  if (m) return Number(m[1]);
  if (/4k/i.test(quality)) return 2160;
  return 0;
}

/** HLS streams can be played but not saved as a single file. */
export function isStreamOnly(source: { type: string; url: string }): boolean {
  return /m3u8/i.test(source.type) || /\.m3u8(\?|$)/i.test(source.url);
}
