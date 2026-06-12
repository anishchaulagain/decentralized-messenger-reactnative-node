import { MaterialIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/palette';

export default function CallsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="h-16 flex-row items-center border-b border-white/5 px-container-padding">
        <Text className="font-inter-bold text-[20px] text-primary">Calls</Text>
      </View>

      <View className="flex-1 items-center justify-center px-xl pb-20">
        <View
          className="mb-lg h-24 w-24 items-center justify-center rounded-full border border-primary/20 bg-surface-container-high"
          style={{
            shadowColor: Palette.primary,
            shadowOpacity: 0.25,
            shadowRadius: 30,
            elevation: 8,
          }}
        >
          <MaterialIcons name="call" size={44} color={Palette.primary} />
        </View>
        <Text className="font-inter-bold text-[26px] text-on-surface">Coming Soon</Text>
        <Text className="mt-sm text-center font-inter text-[14px] leading-5 text-on-surface-variant">
          Encrypted voice and video calls are on the way.{'\n'}Stay tuned for the next update.
        </Text>
        <View className="mt-lg rounded-full border border-white/5 bg-surface-container-high px-md py-xs">
          <Text className="font-mono text-[10px] uppercase tracking-widest text-outline">
            In Development
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
