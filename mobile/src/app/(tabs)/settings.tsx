import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AVATARS } from '@/constants/mock-data';
import { Palette } from '@/constants/palette';

interface SettingsItemProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  tint: string;
  tintBg: string;
  label: string;
  description?: string;
  divider?: boolean;
}

function SettingsItem({ icon, tint, tintBg, label, description, divider = true }: SettingsItemProps) {
  return (
    <>
      <Pressable className="flex-row items-center justify-between p-md active:bg-white/5">
        <View className="flex-1 flex-row items-center gap-md">
          <View
            className="h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: tintBg }}
          >
            <MaterialIcons name={icon} size={22} color={tint} />
          </View>
          <View className="flex-1">
            <Text className="font-inter text-[16px] text-on-surface">{label}</Text>
            {description && (
              <Text className="font-inter-semibold text-[12px] text-outline">{description}</Text>
            )}
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={Palette.outline} />
      </Pressable>
      {divider && <View className="ml-16 h-px bg-white/5" />}
    </>
  );
}

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Top app bar */}
      <View className="h-16 flex-row items-center justify-between border-b border-white/5 px-container-padding">
        <Text className="font-inter-bold text-[20px] text-primary">Settings</Text>
        <Pressable className="h-10 w-10 items-center justify-center active:opacity-80">
          <MaterialIcons name="search" size={24} color={Palette.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="px-container-padding pb-28 pt-lg">
        {/* Profile overview */}
        <View className="mb-xl items-center">
          <View className="relative">
            <LinearGradient
              colors={[Palette.primary, Palette.secondary]}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={{ width: 96, height: 96, borderRadius: 48, padding: 3 }}
            >
              <Image
                source={{ uri: AVATARS.profile }}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 45,
                  borderWidth: 3,
                  borderColor: Palette.background,
                }}
                contentFit="cover"
              />
            </LinearGradient>
            <Pressable
              className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full bg-primary active:scale-90"
              style={{ borderWidth: 2, borderColor: Palette.background }}
            >
              <MaterialIcons name="edit" size={16} color={Palette.onPrimaryContainer} />
            </Pressable>
          </View>
          <Text className="mt-md font-inter-bold text-[26px] text-on-surface">Alex Rivera</Text>
          <Text className="font-inter text-[14px] text-on-surface-variant">@arivera.nexus</Text>
        </View>

        {/* Main settings */}
        <View className="overflow-hidden rounded-xl border border-white/5 bg-surface-container/70">
          <SettingsItem
            icon="account-circle"
            tint={Palette.primary}
            tintBg="rgba(173,198,255,0.1)"
            label="Account"
            description="Privacy, security, change number"
          />
          <SettingsItem
            icon="notifications"
            tint={Palette.secondary}
            tintBg="rgba(208,188,255,0.1)"
            label="Notifications"
            description="Message, group & call tones"
          />
          <SettingsItem
            icon="palette"
            tint={Palette.tertiary}
            tintBg="rgba(78,222,163,0.1)"
            label="Appearance"
            description="Theme, wallpapers, chat font"
          />
          <SettingsItem
            icon="lock"
            tint={Palette.error}
            tintBg="rgba(255,180,171,0.1)"
            label="Privacy"
            description="Block contacts, disappearing messages"
          />
          <SettingsItem
            icon="data-usage"
            tint={Palette.onSurfaceVariant}
            tintBg="rgba(194,198,214,0.1)"
            label="Storage Management"
            description="Network usage, auto-download"
            divider={false}
          />
        </View>

        {/* Support */}
        <Text className="mb-sm mt-lg px-xs font-inter-semibold text-[12px] uppercase tracking-widest text-outline">
          Support
        </Text>
        <View className="overflow-hidden rounded-xl border border-white/5 bg-surface-container/70">
          <SettingsItem
            icon="help"
            tint={Palette.onSurface}
            tintBg={Palette.surfaceContainerHighest}
            label="Help Center"
          />
          <SettingsItem
            icon="info"
            tint={Palette.onSurface}
            tintBg={Palette.surfaceContainerHighest}
            label="About App"
            divider={false}
          />
        </View>

        {/* Log out */}
        <Pressable
          onPress={() => router.replace('/login')}
          className="mt-xl rounded-xl border border-error/20 bg-error/10 py-md active:scale-95"
        >
          <Text className="text-center font-inter-semibold text-[16px] text-error">Log Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
