/**
 * Arad (OFL) is shipped as a variable font. React Native on Android cannot pick weights from a
 * variable font, so assets/fonts holds static instances cut from Arad-VF.ttf (scripts/build-fonts.py).
 * Each weight is registered as its own family and picked by `fontFor(weight)`.
 */
export const fontFiles = {
  'Arad-Regular': require('../../assets/fonts/Arad-Regular.ttf'),
  'Arad-Medium': require('../../assets/fonts/Arad-Medium.ttf'),
  'Arad-SemiBold': require('../../assets/fonts/Arad-SemiBold.ttf'),
  'Arad-Bold': require('../../assets/fonts/Arad-Bold.ttf'),
  'Arad-ExtraBold': require('../../assets/fonts/Arad-ExtraBold.ttf'),
};

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
