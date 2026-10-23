/**
 * The catalogue's `description` is an info card, not a synopsis: `key: value` lines (original title,
 * rating, genre, director, stars, format, size, ...) followed by `خلاصه داستان:` and the real story,
 * often ending with a note such as `زیرنویس چسبیده پارسی`. This splits it so the screens can show the
 * story as the story and the useful fields as fields. Pure and platform-free (unit tested).
 */

export type ParsedDescription = {
  /** The story itself, possibly empty. */
  synopsis: string;
  /** Normalised fields (see `FIELD_KEYS`), values trimmed. */
  fields: Partial<Record<FieldKey, string>>;
  /** A trailing source note (hard-sub, dubbing), kept apart from the story. */
  note: string;
};

export type FieldKey = 'originalTitle' | 'persianTitle' | 'genres' | 'country' | 'language' | 'ageRating' | 'director' | 'cast' | 'network' | 'episodes' | 'year' | 'format' | 'quality' | 'size' | 'rating' | 'otherTitles' | 'status' | 'airing';

const FIELD_KEYS: Record<string, FieldKey> = {
  'نام اصلی': 'originalTitle',
  'نام فیلم': 'persianTitle',
  'نام پارسی': 'persianTitle',
  'سایر عناوین': 'otherTitles',
  ژانر: 'genres',
  'محصول کشور': 'country',
  کشور: 'country',
  زبان: 'language',
  'رده سنی': 'ageRating',
  کارگردان: 'director',
  ستارگان: 'cast',
  'پخش از شبکه': 'network',
  'تعداد قسمت ها': 'episodes',
  'تعداد قسمت‌ها': 'episodes',
  'سال انتشار': 'year',
  'تاریخ انتشار': 'year',
  فرمت: 'format',
  کیفیت: 'quality',
  حجم: 'size',
  'امتیاز فیلم': 'rating',
  'امتیاز سریال': 'rating',
  وضعیت: 'status',
  'روز های پخش': 'airing',
};

// Movies say "خلاصه داستان", series often "خلاصه سریال".
const MARKER = /خلاصه[\s\u200c]*(?:ی[\s\u200c]*)?(?:داستان|سریال|فیلم)\s*[:：]?/;
const FIELD_LINE = /^\s*([^\n:：]{2,32}?)\s*[:：]\s*(.*?)\s*$/;
const NOTE = /زیرنویس.{0,12}چسبیده|چسبیده.{0,12}زیرنویس|دوبله|hardsub/i;

/** "نام اصلی سریال " -> "نام اصلی": the series wording adds a word and stray spaces. */
function normaliseKey(raw: string): string {
  return raw.replace(/[‌‏‎]/g, ' ').replace(/\s*سریال\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

const clean = (s: string) => s.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

export function parseDescription(raw: string | null | undefined): ParsedDescription {
  const empty: ParsedDescription = { synopsis: '', fields: {}, note: '' };
  const text = clean(raw ?? '');
  if (!text) return empty;

  const marker = MARKER.exec(text);
  const head = marker ? text.slice(0, marker.index) : text;
  const tail = marker ? text.slice(marker.index + marker[0].length) : '';

  const fields: ParsedDescription['fields'] = {};
  let fieldLines = 0;
  for (const line of head.split('\n')) {
    const m = FIELD_LINE.exec(line);
    if (!m) continue;
    const key = FIELD_KEYS[normaliseKey(m[1]!)];
    if (!key) continue;
    fieldLines++;
    if (m[2] && fields[key] === undefined) fields[key] = m[2].trim();
  }

  // Not a card: an ordinary description is shown as it is. (A paragraph containing a colon, or a
  // single "ژانر: ..." line, must not be mistaken for one.)
  if (!marker && fieldLines < 3) return { ...empty, synopsis: text };

  let synopsis = clean(tail);
  let note = '';
  const lines = synopsis.split('\n');
  // Peel what the card appends after the story: blank lines, source notes, and trailing fields such as
  // "وضعیت سریال: به پایان رسیده است".
  const trailingField = (line: string) => {
    const m = FIELD_LINE.exec(line);
    return m && FIELD_KEYS[normaliseKey(m[1]!)] ? { key: FIELD_KEYS[normaliseKey(m[1]!)]!, value: (m[2] ?? '').trim() } : null;
  };
  while (lines.length) {
    const line = lines[lines.length - 1]!;
    const field = trailingField(line);
    if (line.trim() === '') lines.pop();
    else if (NOTE.test(line)) {
      lines.pop();
      note = note ? `${line.trim()}، ${note}` : line.trim();
    } else if (field) {
      lines.pop();
      if (field.value && fields[field.key] === undefined) fields[field.key] = field.value;
    } else break;
  }
  synopsis = lines.join('\n').trim();
  return { synopsis, fields, note };
}
