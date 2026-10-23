import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { describeCrash } from '@/lib/crash';

/**
 * What the user sees when a screen throws while rendering.
 *
 * Deliberately self-contained: it uses no theme, router or settings hooks, because the error may be
 * in exactly those providers. Colours are the dark palette's, and fonts fall back to the system.
 */
export function CrashScreen({ error, retry, onBack }: { error: unknown; retry: () => void; onBack?: () => void }) {
  const [copied, setCopied] = useState(false);
  const details = describeCrash(error, { platform: Platform.OS, version: Constants.expoConfig?.version ?? '' });

  const button = (label: string, onPress: () => void, primary = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minHeight: 48, paddingHorizontal: 22, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: primary ? '#F2B544' : 'rgba(255,255,255,0.08)', borderWidth: primary ? 0 : 1, borderColor: 'rgba(255,255,255,0.18)' }}
    >
      <Text style={{ color: primary ? '#140E04' : '#F4F1EA', fontSize: 15, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );

  return (
    <View accessibilityRole="alert" style={{ flex: 1, backgroundColor: '#08080C', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', gap: 14, maxWidth: 560 }} style={{ flexGrow: 0 }}>
        <Text style={{ color: '#F4F1EA', fontSize: 22, fontWeight: '800', textAlign: 'center', writingDirection: 'rtl' }}>مشکلی پیش آمد</Text>
        <Text style={{ color: '#C9C5D3', fontSize: 14, lineHeight: 24, textAlign: 'center', writingDirection: 'rtl' }}>
          این صفحه نتوانست درست نمایش داده شود. دوباره امتحان کنید؛ اگر تکرار شد، جزئیات را کپی کنید و گزارش دهید.
        </Text>
        <View style={{ alignSelf: 'stretch', padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <Text selectable style={{ color: '#8E8A9E', fontSize: 11, lineHeight: 17, writingDirection: 'ltr', textAlign: 'left' }}>
            {details.split('\n').slice(0, 4).join('\n')}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 6 }}>
          {button('تلاش دوباره', retry, true)}
          {onBack ? button('بازگشت', onBack) : null}
          {Platform.OS === 'web' && typeof window !== 'undefined' ? button('بارگذاری دوباره', () => window.location.reload()) : null}
          {button(copied ? 'کپی شد' : 'کپی جزئیات', () => {
            void Clipboard.setStringAsync(details).then(() => setCopied(true));
          })}
        </View>
      </ScrollView>
    </View>
  );
}
