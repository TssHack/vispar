import { useEffect, useRef } from 'react';
import { Animated, Platform, View, type StyleProp, type ViewStyle } from 'react-native';

import { ApiError } from '@/api/client';
import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(v, { toValue: 0.5, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View aria-hidden style={[{ backgroundColor: colors.surface2, opacity: v }, style]} />;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.message === 'timeout') return 'سرور پاسخ نداد. اتصال اینترنت را بررسی کنید.';
    if (error.status) return `خطا در دریافت اطلاعات (کد ${error.status})`;
  }
  return 'اتصال برقرار نشد. اینترنت را بررسی کنید و دوباره تلاش کنید.';
}

export function ErrorState({ error, onRetry, compact }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  return (
    <View
      accessibilityRole="alert"
      style={{ alignItems: 'center', justifyContent: 'center', gap: 12, padding: compact ? 16 : 32 }}
    >
      <Icon name="alert" size={compact ? 24 : 36} color="muted" />
      <Text size={14} color="text2" align="center">
        {errorMessage(error)}
      </Text>
      {onRetry ? <Button label="تلاش دوباره" icon="refresh" variant="surface" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: 6, padding: 32 }}>
      <Text size={16} weight={700} align="center">
        {title}
      </Text>
      {body ? (
        <Text size={13} color="muted" align="center">
          {body}
        </Text>
      ) : null}
      {children ? <View style={{ marginTop: 10 }}>{children}</View> : null}
    </View>
  );
}
