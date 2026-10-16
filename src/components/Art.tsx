import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { posterTints } from '@/theme/tokens';

type Props = {
  uri?: string;
  /** Picks a stable placeholder tint while loading or when the image is missing. */
  seed: number;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  children?: React.ReactNode;
};

/** Remote poster/cover image over a tinted placeholder, so empty or broken URLs still look intentional. */
export function Art({ uri, seed, style, radius = 14, children }: Props) {
  const [failed, setFailed] = useState(false);
  const [a, b] = posterTints[Math.abs(seed) % posterTints.length];
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden', backgroundColor: b }, style]}>
      <LinearGradient colors={[a, b]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
          accessible={false}
        />
      ) : null}
      {children}
    </View>
  );
}
