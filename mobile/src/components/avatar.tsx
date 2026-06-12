import { Image } from 'expo-image';
import { View } from 'react-native';

import { Palette } from '@/constants/palette';

interface AvatarProps {
  uri: string;
  size?: number;
  online?: boolean;
  showStatus?: boolean;
}

export function Avatar({ uri, size = 56, online = false, showStatus = true }: AvatarProps) {
  const dotSize = Math.max(10, size * 0.25);
  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.05)',
        }}
        contentFit="cover"
        transition={150}
      />
      {showStatus && (
        <View
          className={online ? 'bg-tertiary' : 'bg-outline'}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            borderWidth: 2,
            borderColor: Palette.background,
            shadowColor: online ? Palette.tertiary : 'transparent',
            shadowOpacity: online ? 0.9 : 0,
            shadowRadius: 4,
            elevation: online ? 4 : 0,
          }}
        />
      )}
    </View>
  );
}
