import { Linking, View } from 'react-native';

import { config, repoUrl } from '@/config';
import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { Focusable } from './Focusable';
import { Logo } from './Logo';
import { Text } from './Text';

/** Web footer: credit to the developer and a link to the source. */
export function Footer() {
  const { colors } = useTheme();
  const { gutter } = useLayout();
  return (
    <View
      style={{
        width: '100%',
        maxWidth: 1440,
        alignSelf: 'center',
        marginTop: 64,
        paddingHorizontal: gutter,
        paddingTop: 28,
        paddingBottom: 40,
        borderTopWidth: 1,
        borderTopColor: colors.line,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
      }}
    >
      <View style={{ gap: 8 }}>
        <Logo size={28} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <Text size={13} color="text2">
            طراحی و توسعه:
          </Text>
          <Focusable onPress={() => Linking.openURL(config.developer.website)} accessibilityRole="link" ringRadius={6}>
            <Text size={13} weight={700}>
              {config.developer.name}
            </Text>
          </Focusable>
          <Text size={13} color="muted">
            ·
          </Text>
          <Focusable onPress={() => Linking.openURL(repoUrl)} accessibilityRole="link" ringRadius={6}>
            <Text size={13} color="text2" style={{ writingDirection: 'ltr' }}>
              {repoUrl.replace('https://', '')}
            </Text>
          </Focusable>
        </View>
      </View>
      <Button
        label="دریافت نسخه اندروید"
        icon="download"
        variant="surface"
        onPress={() => Linking.openURL(`${repoUrl}/releases/latest`)}
      />
    </View>
  );
}
