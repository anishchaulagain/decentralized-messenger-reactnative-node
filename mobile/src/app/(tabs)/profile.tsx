import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { useAuth } from '@/context/auth';
import { avatarUri } from '@/lib/avatar';
import { Palette } from '@/constants/palette';

interface RowProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  tint: string;
  tintBg: string;
  label: string;
  description?: string;
  onPress?: () => void;
}

function Row({ icon, tint, tintBg, label, description, onPress }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between rounded-xl border border-white/5 bg-white/5 p-md active:bg-white/10"
    >
      <View className="flex-row items-center gap-md">
        <View className="h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: tintBg }}>
          <MaterialIcons name={icon} size={22} color={tint} />
        </View>
        <View>
          <Text className="font-inter-medium text-[16px] text-on-surface">{label}</Text>
          {description && (
            <Text className="font-inter text-[13px] text-on-surface-variant">{description}</Text>
          )}
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={24} color={Palette.outline} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const user = session?.user;

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="h-16 flex-row items-center border-b border-white/5 px-container-padding">
        <Text className="font-inter-bold text-[20px] text-primary">Profile</Text>
      </View>

      <ScrollView contentContainerClassName="px-container-padding pb-28 pt-lg">
        {/* Hero */}
        <View className="items-center">
          <Avatar uri={avatarUri(user)} size={112} showStatus={false} />
          <Text className="mt-md font-inter-bold text-[24px] text-on-surface">{user?.name}</Text>
          <Text className="mt-xs font-inter text-[14px] text-on-surface-variant">{user?.email}</Text>
        </View>

        {/* Status */}
        <View className="mt-xl flex-row gap-md">
          <View className="flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5 p-md">
            <Text className="font-mono text-[10px] uppercase tracking-widest text-primary">Account</Text>
            <Text className="mt-xs font-inter-semibold text-[16px] text-on-surface">
              {user?.status === 'APPROVED' ? 'Active' : user?.status?.toLowerCase()}
            </Text>
          </View>
          <View className="flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5 p-md">
            <Text className="font-mono text-[10px] uppercase tracking-widest text-tertiary">Encryption</Text>
            <Text className="mt-xs font-inter-semibold text-[16px] text-on-surface">
              {user?.publicKey ? 'On' : 'Off'}
            </Text>
          </View>
        </View>

        {/* Shortcuts */}
        <Text className="mt-xl px-sm font-inter-semibold text-[12px] uppercase tracking-widest text-outline">
          Security
        </Text>
        <View className="mt-stack-gap gap-xs">
          <Row
            icon="backup"
            tint={Palette.primary}
            tintBg="rgba(173,198,255,0.1)"
            label="Encryption backup"
            description="Recover your key after reinstalling"
            onPress={() => router.push('/backup-key')}
          />
          <Row
            icon="settings"
            tint={Palette.secondary}
            tintBg="rgba(208,188,255,0.1)"
            label="Settings"
            onPress={() => router.push('/(tabs)/settings')}
          />
        </View>

        {/* Sign out */}
        <Pressable
          onPress={handleSignOut}
          className="mt-xl flex-row items-center justify-center gap-xs active:scale-95"
        >
          <MaterialIcons name="logout" size={18} color={Palette.error} />
          <Text className="font-inter-semibold text-[12px] tracking-widest text-error">SIGN OUT</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
