import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Palette } from '@/constants/palette';

const SPLASH_DURATION_MS = 2600;

export default function SplashScreen() {
  const router = useRouter();
  const spin = useSharedValue(0);
  const progress = useSharedValue(0);
  const pulse = useSharedValue(0.6);

  useEffect(() => {
    spin.value = withRepeat(
      withTiming(360, { duration: 10000, easing: Easing.linear }),
      -1,
    );
    pulse.value = withRepeat(withTiming(1, { duration: 1500 }), -1, true);
    progress.value = withTiming(1, {
      duration: SPLASH_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });

    const timer = setTimeout(() => {
      router.replace('/login');
    }, SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [progress, pulse, router, spin]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value + 45}deg` }],
  }));
  const ringStyleReverse = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-spin.value - 12}deg` }],
  }));
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View
      className="flex-1 items-center justify-center px-container-padding"
      style={{ backgroundColor: Palette.splashBackground }}
    >
      {/* Monogram with rotating rings */}
      <View className="items-center justify-center">
        <Animated.View
          style={ringStyle}
          className="absolute h-32 w-32 rounded-2xl border-2 border-primary/20"
        />
        <Animated.View
          style={ringStyleReverse}
          className="absolute h-36 w-36 rounded-3xl border border-secondary/10"
        />
        <View
          className="h-28 w-28 items-center justify-center rounded-2xl bg-surface-container-low"
          style={{
            shadowColor: Palette.primary,
            shadowOpacity: 0.35,
            shadowRadius: 30,
            elevation: 12,
          }}
        >
          <Text className="font-inter-bold text-6xl text-primary">D</Text>
        </View>
      </View>

      {/* Brand */}
      <View className="mt-xl items-center">
        <Text className="font-inter-bold text-[26px] uppercase tracking-[0.2em] text-primary">
          Dipanix
        </Text>
        <Animated.Text
          style={pulseStyle}
          className="mt-sm font-inter-semibold text-[12px] uppercase tracking-widest text-outline"
        >
          Neural Communication
        </Animated.Text>
      </View>

      {/* Loading bar */}
      <View className="mt-xl h-1 w-40 overflow-hidden rounded-full bg-surface-container-high">
        <Animated.View style={progressStyle} className="h-full rounded-full bg-primary" />
      </View>

      {/* Footer */}
      <View className="absolute bottom-12 items-center opacity-40">
        <Text className="font-mono text-[10px] uppercase tracking-tighter text-outline">
          Secure Layer v4.0.2
        </Text>
      </View>
    </View>
  );
}
