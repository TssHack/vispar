/**
 * Decoding subtitle bytes.
 *
 * Persian `.srt` files in the wild are frequently saved as Windows-1256, not UTF-8. Hermes (the React
 * Native engine) only ships a UTF-8 `TextDecoder`, so the legacy code page is decoded here with a
 * small lookup table instead of a dependency. Pure and platform-free, so it is unit tested.
 */

/** Windows-1256 for bytes 0x80-0xFF, in order. 0x00-0x7F are plain ASCII. */
const CP1256_HIGH =
  '€پ‚ƒ„…†‡ˆ‰ٹ‹Œچژڈ' + // 80-8F
  'گ‘’“”•–—ک™ڑ›œ‌‍ں' + // 90-9F
  ' ،¢£¤¥¦§¨©ھ«¬­®¯' + // A0-AF
  '°±²³´µ¶·¸¹؛»¼½¾؟' + // B0-BF
  'ہءآأؤإئابةتثجحخد' + // C0-CF
  'ذرزسشصض×طظعغـفقك' + // D0-DF
  'àلâمنهوçèéêëىيîï' + // E0-EF
  'ًٌٍَôُِ÷ّùْûü‎‏ے'; // F0-FF

/** True when the bytes are well-formed UTF-8 (a cp1256 Persian text almost never is). */
export function isValidUtf8(bytes: Uint8Array): boolean {
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i]!;
    let extra = 0;
    if (b < 0x80) extra = 0;
    else if (b >= 0xc2 && b <= 0xdf) extra = 1;
    else if (b >= 0xe0 && b <= 0xef) extra = 2;
    else if (b >= 0xf0 && b <= 0xf4) extra = 3;
    else return false;
    for (let k = 1; k <= extra; k++) {
      const c = bytes[i + k];
      if (c === undefined || (c & 0xc0) !== 0x80) return false;
    }
    i += extra + 1;
  }
  return true;
}

export function decodeCp1256(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    out += b < 0x80 ? String.fromCharCode(b) : (CP1256_HIGH[b - 0x80] ?? '�');
  }
  return out;
}

function decodeUtf16(bytes: Uint8Array, littleEndian: boolean): string {
  let out = '';
  for (let i = 2; i + 1 < bytes.length; i += 2) {
    const code = littleEndian ? bytes[i]! | (bytes[i + 1]! << 8) : (bytes[i]! << 8) | bytes[i + 1]!;
    out += String.fromCharCode(code);
  }
  return out;
}

/** Arabic yeh/kaf (what cp1256 files contain) -> the Persian letters the rest of the UI uses. */
export const persianise = (text: string): string => text.replace(/ي/g, 'ی').replace(/ك/g, 'ک');

/** UTF-8 (with or without BOM), UTF-16 with BOM, otherwise Windows-1256. */
export function decodeSubtitleBytes(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return decodeUtf16(bytes, true);
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return decodeUtf16(bytes, false);
  if (isValidUtf8(bytes)) return new TextDecoder('utf-8').decode(bytes);
  return persianise(decodeCp1256(bytes));
}
