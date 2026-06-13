import { MaterialIcons } from '@expo/vector-icons';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { useAuth } from '@/context/auth';
import { usersApi } from '@/lib/api';
import { avatarUri } from '@/lib/avatar';
import {
  authenticate,
  biometricLabel,
  isBiometricAvailable,
  isBiometricLockEnabled,
  setBiometricLockEnabled,
} from '@/lib/biometrics';
import { patchUser } from '@/lib/session';
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

function ToggleItem({
  icon,
  tint,
  tintBg,
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  divider = true,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  tint: string;
  tintBg: string;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  divider?: boolean;
}) {
  return (
    <>
      <View className="flex-row items-center justify-between p-md" style={{ opacity: disabled ? 0.5 : 1 }}>
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
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: Palette.surfaceContainerHighest, true: Palette.primaryContainer }}
          thumbColor={value ? Palette.primary : '#f4f3f4'}
        />
      </View>
      {divider && <View className="ml-16 h-px bg-white/5" />}
    </>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const user = session?.user;

  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioLabel, setBioLabel] = useState('Biometrics');
  const [bioBusy, setBioBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const changeAvatar = async () => {
    if (avatarBusy) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    setAvatarBusy(true);
    try {
      // Resize/compress to a small thumbnail so it stays well under the API's
      // body limit and the DB stays lean.
      const rendered = await ImageManipulator.manipulate(picked.assets[0].uri)
        .resize({ width: 256 })
        .renderAsync();
      const out = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.5, base64: true });
      const dataUri = `data:image/jpeg;base64,${out.base64}`;
      const { user: updated } = await usersApi.updateAvatar(dataUri);
      await patchUser({ avatar: updated.avatar });
    } catch (e) {
      Alert.alert('Profile photo', e instanceof Error ? e.message : 'Could not update your photo.');
    } finally {
      setAvatarBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const [available, enabled, label] = await Promise.all([
        isBiometricAvailable(),
        isBiometricLockEnabled(),
        biometricLabel(),
      ]);
      if (!active) return;
      setBioAvailable(available);
      setBioEnabled(enabled);
      setBioLabel(label);
    })();
    return () => {
      active = false;
    };
  }, []);

  const toggleBiometrics = async (next: boolean) => {
    if (bioBusy) return;
    setBioBusy(true);
    try {
      if (next) {
        // Confirm the user can pass the check before turning the lock on, so
        // they can't accidentally lock themselves out.
        const ok = await authenticate(`Confirm ${bioLabel} to enable app lock`);
        if (!ok) return;
        await setBiometricLockEnabled(true);
        setBioEnabled(true);
      } else {
        await setBiometricLockEnabled(false);
        setBioEnabled(false);
      }
    } catch {
      Alert.alert('Biometrics', 'Could not update the app lock setting.');
    } finally {
      setBioBusy(false);
    }
  };

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
          <Pressable onPress={changeAvatar} disabled={avatarBusy} className="active:scale-95">
            <Avatar uri={avatarUri(user)} size={88} showStatus={false} />
            <View className="absolute bottom-0 right-0 h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary">
              {avatarBusy ? (
                <ActivityIndicator size="small" color={Palette.onPrimary} />
              ) : (
                <MaterialIcons name="photo-camera" size={15} color={Palette.onPrimary} />
              )}
            </View>
          </Pressable>
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
          <ToggleItem
            icon="fingerprint"
            tint={Palette.secondary}
            tintBg="rgba(208,188,255,0.1)"
            label="App lock"
            description={
              bioAvailable
                ? `Require ${bioLabel} to open the app`
                : 'No biometrics enrolled on this device'
            }
            value={bioEnabled}
            onValueChange={toggleBiometrics}
            disabled={!bioAvailable || bioBusy}
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
