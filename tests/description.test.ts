import { describe, expect, it } from 'vitest';

import { parseDescription } from '@/lib/description';

// Abridged from the live catalogue.
const MOVIE =
  'نام اصلی:       Thingy\r\n\r\nامتیاز فیلم :  4.8 از 10\r\n\r\nنام فیلم:       تینگی\r\n\r\nژانر:   ترسناک\r\n\r\nمحصول کشور:     آمریکا\r\n\r\nزبان: انگلیسی\r\n\r\nسال انتشار: 2026\r\n\r\nرده سنی:  16\r\n\r\nکارگردان:   Jae Matthews\r\n\r\nستارگان:    Dora Hewitt, Jack Ryan Beckner\r\n\r\nفرمت: mkv\r\n\r\nکیفیت:  720-----1080\r\n\r\nحجم:    808 مگابایت + 1.6 گیگابایت\r\n\r\n\r\nخلاصه داستان:\r\n\r\nزن جوانی که برای فرار به یک مهمانی رفته است، متحدی غیرمنتظره پیدا می‌کند و ... \r\n\r\n\r\nزیرنویس چسبیده پارسی';

const SERIES =
  'نام اصلی سریال :  Small Town Remedy\r\n\r\nامتیاز سریال : 8.2/10\r\n\r\nنام پارسی سریال :   مرهم شهر کوچک\r\n\r\nژانر :  زندگی, درام, پزشکی\r\n\r\nتاریخ انتشار: 2026\r\n\r\nمحصول کشور: چین\r\n\r\nزبان:  چینی\r\n\r\nرده سنی:  16\r\n\r\nپخش از شبکه:  CCTV iQiyi\r\n\r\nتعداد قسمت ها:  30 قسمت\r\n\r\nخلاصه داستان :\r\n\r\nپزشکی به شهر کوچکی برمی‌گردد.';

describe('parseDescription', () => {
  it('splits a movie info card into synopsis, fields and the trailing note', () => {
    const d = parseDescription(MOVIE);
    expect(d.synopsis).toBe('زن جوانی که برای فرار به یک مهمانی رفته است، متحدی غیرمنتظره پیدا می‌کند و ...');
    expect(d.fields.director).toBe('Jae Matthews');
    expect(d.fields.cast).toBe('Dora Hewitt, Jack Ryan Beckner');
    expect(d.fields.language).toBe('انگلیسی');
    expect(d.fields.ageRating).toBe('16');
    expect(d.fields.originalTitle).toBe('Thingy');
    expect(d.note).toBe('زیرنویس چسبیده پارسی');
    expect(d.synopsis).not.toContain('نام اصلی');
  });

  it('understands the series wording (extra word, spaces before the colon)', () => {
    const d = parseDescription(SERIES);
    expect(d.synopsis).toBe('پزشکی به شهر کوچکی برمی‌گردد.');
    expect(d.fields.originalTitle).toBe('Small Town Remedy');
    expect(d.fields.network).toBe('CCTV iQiyi');
    expect(d.fields.episodes).toBe('30 قسمت');
    expect(d.fields.persianTitle).toBe('مرهم شهر کوچک');
  });

  it('keeps an ordinary description unchanged', () => {
    const plain = 'یک داستان ساده درباره‌ی دو دوست.\nدر شهری دور.';
    expect(parseDescription(plain)).toEqual({ synopsis: plain, fields: {}, note: '' });
  });

  it('does not mistake a paragraph with a colon, or one card-like line, for a card', () => {
    const p1 = 'او گفت: برگرد. و رفت، اما چیزی ماند که هیچ‌کس نمی‌دانست.';
    expect(parseDescription(p1).synopsis).toBe(p1);
    const p2 = 'ژانر: ترسناک\nداستان فیلم درباره‌ی خانه‌ای قدیمی است.';
    expect(parseDescription(p2).synopsis).toBe(p2);
  });

  it('returns an empty synopsis for a card without a story, and handles empty input', () => {
    const only = 'نام اصلی: X\r\n\r\nژانر: ترسناک\r\n\r\nزبان: انگلیسی\r\n\r\nکارگردان: Y';
    const d = parseDescription(only);
    expect(d.synopsis).toBe('');
    expect(d.fields.director).toBe('Y');
    for (const v of ['', null, undefined, '   \r\n  ']) expect(parseDescription(v)).toEqual({ synopsis: '', fields: {}, note: '' });
  });

  it('copes with a marker without a colon, ZWNJ in the keys, and a card with no trailing note', () => {
    const d = parseDescription('نام اصلی: A\n\nژانر: B\n\nزبان: C\n\nخلاصه‌ی داستان\n\nمتن داستان.');
    expect(d.synopsis).toBe('متن داستان.');
    expect(d.note).toBe('');
    expect(parseDescription('تعداد‌قسمت‌ها: 3\n\nنام اصلی: A\n\nزبان: C\n\nخلاصه داستان: x').synopsis).toBe('x');
  });
});
