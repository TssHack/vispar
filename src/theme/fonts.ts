/**
 * Arad (OFL) is shipped as a variable font. React Native on Android cannot pick weights from a
 * variable font, so assets/fonts holds static instances cut from Arad-VF.ttf (scripts/build-fonts.py).
 * Each weight is registered as its own family and picked by `fontFor(weight)`. The files are listed
 * in fontFiles.ts (TTF, native) and fontFiles.web.ts (WOFF2, web and desktop).
 */
export { fontFiles } from './fontFiles';
import type { fontFiles } from './fontFiles';

export type Weight = 400 | 500 | 600 | 700 | 800;

export function fontFor(weight: Weight = 400): keyof typeof fontFiles {
  switch (weight) {
    case 500:
      return 'Arad-Medium';
    case 600:
      return 'Arad-SemiBold';
    case 700:
      return 'Arad-Bold';
    case 800:
      return 'Arad-ExtraBold';
    default:
      return 'Arad-Regular';
  }
}
