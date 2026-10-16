import { router } from 'expo-router';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { EmptyState } from './States';

export function NotFound({ title = 'این مورد پیدا نشد', body = 'شاید حذف شده باشد یا لینک اشتباه است.' }: { title?: string; body?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <EmptyState title={title} body={body} />
      <Button label="بازگشت به خانه" variant="surface" onPress={() => router.replace('/')} />
    </View>
  );
}
