import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usersApi } from '@/lib/api';
import { createEncryptedBackup } from '@/lib/crypto';
import { Palette } from '@/constants/palette';

const MIN_PASSPHRASE = 8;

export default function BackupKeyScreen() {
  const router = useRouter();
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = passphrase.length >= MIN_PASSPHRASE && passphrase === confirm && !busy;

  const save = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await createEncryptedBackup(passphrase);
      await usersApi.putBackup(blob);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create backup');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-xl">
          <View className="mb-lg h-20 w-20 items-center justify-center rounded-full border border-tertiary/30 bg-tertiary/10">
            <MaterialIcons name="check-circle" size={40} color={Palette.tertiary} />
          </View>
          <Text className="text-center font-inter-bold text-[22px] text-on-surface">Backup saved</Text>
          <Text className="mt-sm text-center font-inter text-[15px] leading-6 text-on-surface-variant">
            If you reinstall or switch devices, sign in and enter this passphrase to restore your
            key and message history. Keep it safe — it cannot be recovered if lost.
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-xl rounded-xl bg-primary px-xl py-md active:scale-[0.98]"
          >
            <Text className="font-inter-semibold text-[16px] text-on-primary">Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="h-16 flex-row items-center gap-md border-b border-white/5 px-container-padding">
        <Pressable onPress={() => router.back()} className="-ml-2 h-10 w-10 items-center justify-center active:scale-95">
          <MaterialIcons name="arrow-back-ios-new" size={20} color={Palette.primary} />
        </Pressable>
        <Text className="font-inter-semibold text-[18px] text-on-surface">Encryption backup</Text>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerClassName="px-container-padding pb-xl pt-lg" keyboardShouldPersistTaps="handled">
          <Text className="font-inter text-[15px] leading-6 text-on-surface-variant">
            Choose a recovery passphrase. Your private key is encrypted with it and stored on the
            server — which can never read it. You&apos;ll need this passphrase to restore your
            messages on a new device.
          </Text>

          <View className="mt-lg rounded-xl border border-white/10 bg-white/5 p-xl">
            {error && (
              <View className="mb-md rounded-lg border border-error/30 bg-error/10 p-md">
                <Text className="font-inter text-[13px] text-error">{error}</Text>
              </View>
            )}

            <Text className="ml-xs font-inter-medium text-[14px] text-on-surface">Recovery passphrase</Text>
            <View className="mt-sm flex-row items-center rounded-lg border border-white/10 bg-surface-container-lowest px-md">
              <MaterialIcons name="vpn-key" size={20} color={Palette.outline} />
              <TextInput
                className="ml-sm flex-1 py-md font-inter text-[16px] text-on-surface"
                placeholder={`At least ${MIN_PASSPHRASE} characters`}
                placeholderTextColor={`${Palette.outline}99`}
                secureTextEntry={!show}
                autoCapitalize="none"
                value={passphrase}
                onChangeText={setPassphrase}
              />
              <Pressable hitSlop={8} onPress={() => setShow((v) => !v)}>
                <MaterialIcons name={show ? 'visibility-off' : 'visibility'} size={20} color={Palette.outline} />
              </Pressable>
            </View>

            <Text className="ml-xs mt-md font-inter-medium text-[14px] text-on-surface">Confirm passphrase</Text>
            <View className="mt-sm flex-row items-center rounded-lg border border-white/10 bg-surface-container-lowest px-md">
              <MaterialIcons name="vpn-key" size={20} color={Palette.outline} />
              <TextInput
                className="ml-sm flex-1 py-md font-inter text-[16px] text-on-surface"
                placeholder="Re-enter passphrase"
                placeholderTextColor={`${Palette.outline}99`}
                secureTextEntry={!show}
                autoCapitalize="none"
                value={confirm}
                onChangeText={setConfirm}
                onSubmitEditing={save}
                returnKeyType="go"
              />
            </View>

            <Pressable
              onPress={save}
              disabled={!canSubmit}
              className="mt-lg rounded-lg bg-primary py-md active:scale-[0.98]"
              style={{ opacity: canSubmit ? 1 : 0.5 }}
            >
              <Text className="text-center font-inter-semibold text-[16px] text-on-primary">
                {busy ? 'Saving…' : 'Save backup'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
