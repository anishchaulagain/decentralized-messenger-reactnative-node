import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AVATARS } from '@/constants/mock-data';
import { Palette } from '@/constants/palette';

interface SettingRowProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  tint: string;
  tintBg: string;
  label: string;
}

function SettingRow({ icon, tint, tintBg, label }: SettingRowProps) {
  return (
    <Pressable className="flex-row items-center justify-between rounded-xl border border-white/5 bg-white/5 p-md active:bg-white/10">
      <View className="flex-row items-center gap-md">
        <View
          className="h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: tintBg }}
        >
          <MaterialIcons name={icon} size={22} color={tint} />
        </View>
        <Text className="font-inter-medium text-[16px] text-on-surface">{label}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={24} color={Palette.outline} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(true);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Top app bar */}
      <View className="h-16 flex-row items-center justify-between border-b border-white/5 px-container-padding">
        <Text className="font-inter-bold text-[20px] text-primary">Profile</Text>
        <Pressable className="h-10 w-10 items-center justify-center active:opacity-80">
          <MaterialIcons name="search" size={24} color={Palette.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="px-container-padding pb-28 pt-lg">
        {/* Hero */}
        <View className="items-center">
          <View
            className="rounded-full border-2 border-primary/30 p-1"
            style={{
              shadowColor: Palette.primary,
              shadowOpacity: 0.3,
              shadowRadius: 24,
              elevation: 10,
            }}
          >
            <Image
              source={{ uri: AVATARS.profile }}
              style={{ width: 128, height: 128, borderRadius: 64 }}
              contentFit="cover"
            />
          </View>
          <Text className="mt-md font-inter-bold text-[26px] text-on-surface">Alex Rivers</Text>
          <Text className="mt-xs max-w-[300px] text-center font-inter text-[16px] leading-6 text-on-surface-variant">
            Digital Architect & Strategy Lead. Designing the future of decentralized communication.
          </Text>
        </View>

        {/* Stats */}
        <View className="mt-xl flex-row gap-md">
          <View className="flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5 p-md">
            <Text className="font-mono text-[10px] uppercase tracking-widest text-primary">
              Connections
            </Text>
            <Text className="mt-xs font-inter-semibold text-[20px] text-on-surface">1.2k</Text>
          </View>
          <View className="flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5 p-md">
            <Text className="font-mono text-[10px] uppercase tracking-widest text-tertiary">
              Status
            </Text>
            <Text className="mt-xs font-inter-semibold text-[20px] text-on-surface">Active</Text>
          </View>
        </View>

        {/* Preferences */}
        <Text className="mt-xl px-sm font-inter-semibold text-[12px] uppercase tracking-widest text-outline">
          Preferences
        </Text>
        <View className="mt-stack-gap flex-row items-center justify-between rounded-xl border border-white/5 bg-white/5 p-md">
          <View className="flex-row items-center gap-md">
            <View className="h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <MaterialIcons name="dark-mode" size={22} color={Palette.primary} />
            </View>
            <View>
              <Text className="font-inter-medium text-[16px] text-on-surface">Dark Mode</Text>
              <Text className="font-inter text-[14px] text-on-surface-variant">
                Enhanced for focus
              </Text>
            </View>
          </View>
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: Palette.outlineVariant, true: Palette.primary }}
            thumbColor={Palette.onPrimary}
          />
        </View>

        {/* Security & access */}
        <Text className="mt-lg px-sm font-inter-semibold text-[12px] uppercase tracking-widest text-outline">
          Security & Access
        </Text>
        <View className="mt-stack-gap gap-xs">
          <SettingRow
            icon="account-circle"
            tint={Palette.secondary}
            tintBg="rgba(208,188,255,0.1)"
            label="Account"
          />
          <SettingRow
            icon="lock"
            tint={Palette.tertiary}
            tintBg="rgba(78,222,163,0.1)"
            label="Privacy"
          />
          <SettingRow
            icon="security"
            tint={Palette.error}
            tintBg="rgba(255,180,171,0.1)"
            label="Security"
          />
        </View>

        {/* Sign out */}
        <Pressable
          onPress={() => router.replace('/login')}
          className="mt-xl flex-row items-center justify-center gap-xs active:scale-95"
        >
          <MaterialIcons name="logout" size={18} color={Palette.error} />
          <Text className="font-inter-semibold text-[12px] tracking-widest text-error">
            SIGN OUT
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
