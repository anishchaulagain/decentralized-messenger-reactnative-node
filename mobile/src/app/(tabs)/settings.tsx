import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { useAuth } from '@/context/auth';
import { Palette } from '@/constants/palette';

interface ItemProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  tint: string;
  tintBg: string;
  label: string;
  description?: string;
  divider?: boolean;
  onPress?: () => void;
}

function Item({ icon, tint, tintBg, label, description, divider = true, onPress }: ItemProps) {
  return (
    <>
      <Pressable onPress={onPress} className="flex-row items-center justify-between p-md active:bg-white/5">
        <View className="flex-1 flex-row items-center gap-md">
          <View className="h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: tintBg }}>
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
  const { session, signOut } = useAuth();
  const user = session?.user;

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="h-16 flex-row items-center border-b border-white/5 px-container-padding">
        <Text className="font-inter-bold text-[20px] text-primary">Settings</Text>
      </View>

      <ScrollView contentContainerClassName="px-container-padding pb-28 pt-lg">
        {/* Profile overview */}
        <View className="mb-xl items-center">
          <Avatar uri={`https://i.pravatar.cc/150?u=${user?.id}`} size={88} showStatus={false} />
          <Text className="mt-md font-inter-bold text-[22px] text-on-surface">{user?.name}</Text>
          <Text className="font-inter text-[14px] text-on-surface-variant">{user?.email}</Text>
        </View>

        {/* Security */}
        <Text className="mb-sm px-xs font-inter-semibold text-[12px] uppercase tracking-widest text-outline">
          Security
        </Text>
        <View className="overflow-hidden rounded-xl border border-white/5 bg-surface-container/70">
          <Item
            icon="backup"
            tint={Palette.primary}
            tintBg="rgba(173,198,255,0.1)"
            label="Encryption backup"
            description="Recover your key & history after reinstall"
            onPress={() => router.push('/backup-key')}
          />
          <Item
            icon="lock"
            tint={Palette.tertiary}
            tintBg="rgba(78,222,163,0.1)"
            label="Privacy"
            description="End-to-end encrypted by default"
            divider={false}
          />
        </View>

        {/* Support */}
        <Text className="mb-sm mt-lg px-xs font-inter-semibold text-[12px] uppercase tracking-widest text-outline">
          Support
        </Text>
        <View className="overflow-hidden rounded-xl border border-white/5 bg-surface-container/70">
          <Item icon="help" tint={Palette.onSurface} tintBg={Palette.surfaceContainerHighest} label="Help Center" />
          <Item
            icon="info"
            tint={Palette.onSurface}
            tintBg={Palette.surfaceContainerHighest}
            label="About Dipanix"
            divider={false}
          />
        </View>

        {/* Log out */}
        <Pressable
          onPress={handleLogout}
          className="mt-xl rounded-xl border border-error/20 bg-error/10 py-md active:scale-95"
        >
          <Text className="text-center font-inter-semibold text-[16px] text-error">Log Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
