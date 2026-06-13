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
import { getPublicKey, restoreFromBackup } from '@/lib/crypto';
import { patchUser } from '@/lib/session';
import { Palette } from '@/constants/palette';

export default function RestoreKeyScreen() {
  const router = useRouter();
  const [passphrase, setPassphrase] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const restore = async () => {
    if (!passphrase || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { backup } = await usersApi.getBackup();
      if (!backup) {
        setError('No encryption backup was found for this account.');
        return;
      }
      const publicKey = await restoreFromBackup(passphrase, backup);
      await usersApi.uploadPublicKey(publicKey).catch(() => undefined);
      await patchUser({ publicKey });
      router.replace('/(tabs)/chats');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not restore your key');
    } finally {
      setBusy(false);
    }
  };

  const startFresh = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const publicKey = await getPublicKey(); // generates a new keypair
      await usersApi.uploadPublicKey(publicKey);
      await patchUser({ publicKey });
      router.replace('/(tabs)/chats');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not set up a new key');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-container-padding py-lg"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-lg items-center">
            <View className="mb-md h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-surface-container-high">
              <MaterialIcons name="lock-reset" size={32} color={Palette.primary} />
            </View>
            <Text className="font-inter-bold text-[24px] text-on-surface">Restore encryption</Text>
            <Text className="mt-xs text-center font-inter text-[14px] leading-6 text-on-surface-variant">
              Enter your recovery passphrase to restore your key and unlock your message history on
              this device.
            </Text>
          </View>

          <View className="rounded-xl border border-white/10 bg-white/5 p-xl">
            {error && (
              <View className="mb-md rounded-lg border border-error/30 bg-error/10 p-md">
                <Text className="font-inter text-[13px] text-error">{error}</Text>
              </View>
            )}

            <Text className="ml-xs font-inter-medium text-[14px] text-on-surface">
              Recovery passphrase
            </Text>
            <View className="mt-sm flex-row items-center rounded-lg border border-white/10 bg-surface-container-lowest px-md">
              <MaterialIcons name="vpn-key" size={20} color={Palette.outline} />
              <TextInput
                className="ml-sm flex-1 py-md font-inter text-[16px] text-on-surface"
                placeholder="Your recovery passphrase"
                placeholderTextColor={`${Palette.outline}99`}
                secureTextEntry={!show}
                autoCapitalize="none"
                value={passphrase}
                onChangeText={setPassphrase}
                onSubmitEditing={restore}
                returnKeyType="go"
              />
              <Pressable hitSlop={8} onPress={() => setShow((v) => !v)}>
                <MaterialIcons
                  name={show ? 'visibility-off' : 'visibility'}
                  size={20}
                  color={Palette.outline}
                />
              </Pressable>
            </View>

            <Pressable
              onPress={restore}
              disabled={!passphrase || busy}
              className="mt-lg rounded-lg bg-primary py-md active:scale-[0.98]"
              style={{ opacity: !passphrase || busy ? 0.5 : 1 }}
            >
              <Text className="text-center font-inter-semibold text-[16px] text-on-primary">
                {busy ? 'Restoring…' : 'Restore'}
              </Text>
            </Pressable>
          </View>

          <Pressable onPress={startFresh} disabled={busy} className="mt-lg py-sm active:opacity-80">
            <Text className="text-center font-inter-medium text-[13px] text-outline">
              Forgot it? Start fresh with a new key (older messages stay unreadable)
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
