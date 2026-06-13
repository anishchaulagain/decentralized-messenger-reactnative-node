import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth';
import { ApiError } from '@/lib/api';
import { ensureKeysReady } from '@/lib/e2ee-setup';
import { Palette } from '@/constants/palette';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const router = useRouter();
  const { signIn: authSignIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => EMAIL_RE.test(email.trim()) && password.length >= 1 && !submitting,
    [email, password, submitting],
  );

  const signIn = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await authSignIn(email.trim(), password);
      // Make sure this device has an E2EE keypair (or restore one from backup).
      const keyState = await ensureKeysReady();
      router.replace(keyState === 'needs-restore' ? '/restore-key' : '/(tabs)/chats');
    } catch (e) {
      const msg =
        e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
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

      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-container-padding py-lg"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <View className="mb-xl items-center">
            <LinearGradient
              colors={[Palette.primary, Palette.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                shadowColor: Palette.primary,
                shadowOpacity: 0.4,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 8 },
                elevation: 10,
              }}
            >
              <MaterialIcons name="hub" size={32} color={Palette.onPrimary} />
            </LinearGradient>
            <Text className="font-inter-bold text-[28px] tracking-tight text-on-surface">
              Dipanix
            </Text>
            <Text className="mt-xs font-inter text-[14px] text-on-surface-variant">
              Secure, decentralized messaging
            </Text>
          </View>

          {/* Card */}
          <View className="rounded-xl border border-white/10 bg-white/5 p-xl">
            <Text className="font-inter-semibold text-[22px] text-on-surface">Welcome back</Text>
            <Text className="mt-xs font-inter text-[14px] text-on-surface-variant">
              Sign in to continue to your account.
            </Text>

            {error && (
              <View className="mt-md rounded-lg border border-error/30 bg-error/10 p-md">
                <Text className="font-inter text-[13px] text-error">{error}</Text>
              </View>
            )}

            {/* Email */}
            <View className="mt-lg">
              <Text className="ml-xs font-inter-medium text-[14px] text-on-surface">Email</Text>
              <View className="mt-sm flex-row items-center rounded-lg border border-white/10 bg-surface-container-lowest px-md focus:border-primary">
                <MaterialIcons name="mail-outline" size={20} color={Palette.outline} />
                <TextInput
                  className="ml-sm flex-1 py-md font-inter text-[16px] text-on-surface"
                  placeholder="you@example.com"
                  placeholderTextColor={`${Palette.outline}99`}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            {/* Password */}
            <View className="mt-lg">
              <View className="flex-row items-center justify-between px-xs">
                <Text className="font-inter-medium text-[14px] text-on-surface">Password</Text>
                <Pressable hitSlop={8}>
                  <Text className="font-inter-medium text-[13px] text-primary">
                    Forgot password?
                  </Text>
                </Pressable>
              </View>
              <View className="mt-sm flex-row items-center rounded-lg border border-white/10 bg-surface-container-lowest px-md">
                <MaterialIcons name="lock-outline" size={20} color={Palette.outline} />
                <TextInput
                  className="ml-sm flex-1 py-md font-inter text-[16px] text-on-surface"
                  placeholder="Enter your password"
                  placeholderTextColor={`${Palette.outline}99`}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={signIn}
                  returnKeyType="go"
                />
                <Pressable hitSlop={8} onPress={() => setShowPassword((v) => !v)}>
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={20}
                    color={Palette.outline}
                  />
                </Pressable>
              </View>
            </View>

            {/* Sign in */}
            <Pressable
              onPress={signIn}
              disabled={!canSubmit}
              className="mt-xl active:scale-[0.98]"
              style={{ opacity: canSubmit ? 1 : 0.5 }}
            >
              <LinearGradient
                colors={[Palette.primaryContainer, Palette.tertiary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ borderRadius: 8, paddingVertical: 16, alignItems: 'center' }}
              >
                <Text className="font-inter-semibold text-[16px] text-white">
                  {submitting ? 'Signing in…' : 'Sign In'}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Footer */}
          <View className="mt-xl flex-row items-center justify-center">
            <Text className="font-inter text-[14px] text-on-surface-variant">
              Don&apos;t have an account?{' '}
            </Text>
            <Pressable hitSlop={8} onPress={() => router.push('/signup')}>
              <Text className="font-inter-bold text-[14px] text-primary">Sign Up</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
