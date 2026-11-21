import { Tabs } from 'expo-router/js-tabs';
import { View } from 'react-native';

import { BottomNav, SideRail, TopNav } from '@/components/AppNav';
import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/theme/ThemeProvider';

export default function TabsLayout() {
  const { isTV, isWide } = useLayout();
  const { colors } = useTheme();
  const phone = !isTV && !isWide;

  const tabs = (
    <Tabs
      tabBar={phone ? () => <BottomNav /> : () => null}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: 'خانه' }} />
      <Tabs.Screen name="movies" options={{ title: 'فیلم‌ها' }} />
      <Tabs.Screen name="series" options={{ title: 'سریال‌ها' }} />
      <Tabs.Screen name="search" options={{ title: 'جستجو' }} />
      <Tabs.Screen name="library" options={{ title: 'کتابخانه' }} />
      <Tabs.Screen name="settings" options={{ title: 'تنظیمات' }} />
    </Tabs>
  );

  if (isTV) {
    // RTL row: the rail is the first child, so it sits on the right.
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
        <SideRail />
        <View style={{ flex: 1 }}>{tabs}</View>
      </View>
    );
  }
  if (isWide) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopNav />
        <View style={{ flex: 1 }}>{tabs}</View>
      </View>
    );
  }
  return tabs;
}
