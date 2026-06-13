import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/palette';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const signIn = () => {
    router.replace('/(tabs)/chats');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Atmospheric background blobs */}
      <View
        className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary opacity-10"
        style={{ transform: [{ scale: 1.4 }] }}
      />
      <View
        className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-secondary-container opacity-15"
        style={{ transform: [{ scale: 1.4 }] }}
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-container-padding py-lg"
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand */}
          <View className="mb-xl items-center">
            <View className="mb-md h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-surface-container-high shadow-lg">
              <MaterialIcons name="hub" size={30} color={Palette.primary} />
            </View>
            <Text className="font-inter-bold text-[26px] tracking-tight text-on-surface">
              Dipanix
            </Text>
            <Text className="mt-xs font-inter-semibold text-[12px] uppercase tracking-widest text-outline">
              Autonomous Portal
            </Text>
          </View>

          {/* Glass card */}
          <View className="rounded-xl border border-white/10 bg-white/5 p-xl">
            <Text className="font-inter-semibold text-[20px] text-on-surface">Welcome back</Text>
            <Text className="mt-xs font-inter text-[14px] text-on-surface-variant">
              Access your cerebral command center.
            </Text>

            {/* Email */}
            <View className="mt-lg">
              <Text className="ml-xs font-inter-semibold text-[12px] tracking-widest text-on-surface-variant">
                SYSTEM ID (EMAIL)
              </Text>
              <View className="mt-xs flex-row items-center rounded-lg border border-white/10 bg-surface-container-lowest px-md">
                <MaterialIcons name="alternate-email" size={18} color={Palette.outline} />
                <TextInput
                  className="ml-sm flex-1 py-md font-inter text-[16px] text-on-surface"
                  placeholder="name@nexus.com"
                  placeholderTextColor={`${Palette.outline}80`}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            {/* Password */}
            <View className="mt-md">
              <View className="flex-row items-center justify-between px-xs">
                <Text className="font-inter-semibold text-[12px] tracking-widest text-on-surface-variant">
                  ACCESS KEY
                </Text>
                <Pressable hitSlop={8}>
                  <Text className="font-inter-semibold text-[12px] text-primary">Forgot Key?</Text>
                </Pressable>
              </View>
              <View className="mt-xs flex-row items-center rounded-lg border border-white/10 bg-surface-container-lowest px-md">
                <MaterialIcons name="lock" size={18} color={Palette.outline} />
                <TextInput
                  className="ml-sm flex-1 py-md font-inter text-[16px] text-on-surface"
                  placeholder="••••••••"
                  placeholderTextColor={`${Palette.outline}80`}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
            </View>

            {/* Sign in */}
            <Pressable onPress={signIn} className="mt-lg active:scale-[0.98]">
              <LinearGradient
                colors={[Palette.primaryContainer, Palette.secondaryContainer]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 8, paddingVertical: 16, alignItems: 'center' }}
              >
                <Text className="font-inter-semibold text-[18px] text-white">Sign In</Text>
              </LinearGradient>
            </Pressable>

            {/* Divider */}
            <View className="mt-lg flex-row items-center gap-md">
              <View className="h-px flex-1 bg-white/10" />
              <Text className="font-mono text-[10px] uppercase text-outline">
                External Authentication
              </Text>
              <View className="h-px flex-1 bg-white/10" />
            </View>

            {/* Social */}
            <View className="mt-lg flex-row gap-md">
              <Pressable className="flex-1 flex-row items-center justify-center gap-sm rounded-lg border border-white/10 py-md active:bg-white/5">
                <MaterialIcons name="public" size={20} color={Palette.onSurface} />
                <Text className="font-inter-semibold text-[12px] text-on-surface">Google</Text>
              </Pressable>
              <Pressable className="flex-1 flex-row items-center justify-center gap-sm rounded-lg border border-white/10 py-md active:bg-white/5">
                <MaterialIcons name="apps" size={20} color={Palette.onSurface} />
                <Text className="font-inter-semibold text-[12px] text-on-surface">Apple</Text>
              </Pressable>
            </View>
          </View>

          {/* Footer */}
          <View className="mt-xl flex-row items-center justify-center">
            <Text className="font-inter text-[14px] text-on-surface-variant">
              New to the platform?{' '}
            </Text>
            <Pressable hitSlop={8}>
              <Text className="font-inter-bold text-[13px] text-primary">Create Account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
