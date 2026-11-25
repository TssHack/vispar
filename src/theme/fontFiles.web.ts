/**
 * The web, PWA and desktop builds load WOFF2: the same glyphs at half the size of the TTF (126 KB
 * against 290 KB for the five weights), and the first screen waits for these fonts.
 */
export const fontFiles = {
  'Arad-Regular': require('../../assets/fonts/Arad-Regular.woff2'),
  'Arad-Medium': require('../../assets/fonts/Arad-Medium.woff2'),
  'Arad-SemiBold': require('../../assets/fonts/Arad-SemiBold.woff2'),
  'Arad-Bold': require('../../assets/fonts/Arad-Bold.woff2'),
  'Arad-ExtraBold': require('../../assets/fonts/Arad-ExtraBold.woff2'),
};
