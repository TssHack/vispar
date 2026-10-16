import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Source } from '@/api/types';
import type { PlayContext } from '@/external/actions';
import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/theme/ThemeProvider';

import { Focusable } from './Focusable';
import { Icon } from './Icon';
import { SourceList } from './SourceList';
import { Text } from './Text';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  sources: Source[];
  ctx: PlayContext;
};

/** Bottom sheet (centered dialog on TV/desktop) to pick a quality or an external app for an episode. */
export function QualitySheet({ visible, onClose, title, subtitle, sources, ctx }: Props) {
  const { colors } = useTheme();
  const { isWide, isTV } = useLayout();
  const insets = useSafeAreaInsets();
  const centered = isWide || isTV;
  return (
    <Modal visible={visible} transparent animationType={centered ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: centered ? 'center' : 'flex-end', alignItems: 'center' }}>
        <Pressable accessibilityLabel="بستن" onPress={onClose} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(4,4,7,0.72)' }} />
        <View
          accessibilityViewIsModal
          style={{
            width: centered ? 560 : '100%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderRadius: centered ? 28 : undefined,
            padding: 16,
            paddingBottom: 16 + (centered ? 0 : insets.bottom),
            gap: 14,
          }}
        >
          {!centered ? <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong }} /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              {subtitle ? (
                <Text size={12} color="text2">
                  {subtitle}
                </Text>
              ) : null}
              <Text size={18} weight={800} accessibilityRole="header">
                {title}
              </Text>
            </View>
            <Focusable onPress={onClose} accessibilityRole="button" accessibilityLabel="بستن" ringRadius={14} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={18} />
            </Focusable>
          </View>
          <Text size={13} weight={700} color="text2">
            کیفیت یا برنامه‌ی پخش را انتخاب کنید
          </Text>
          <SourceList sources={sources} ctx={ctx} onDone={onClose} />
        </View>
      </View>
    </Modal>
  );
}
