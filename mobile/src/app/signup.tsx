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

import { ApiError, authApi } from '@/lib/api';
import { Palette } from '@/constants/palette';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const passwordsMatch = confirm.length > 0 && password === confirm;
  const confirmMismatch = confirm.length > 0 && password !== confirm;

  const canSubmit = useMemo(
    () =>
      name.trim().length > 0 &&
      EMAIL_RE.test(email.trim()) &&
      password.length >= MIN_PASSWORD &&
      passwordsMatch,
    [name, email, password, passwordsMatch],
  );

  const signUp = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await authApi.register({ name: name.trim(), email: email.trim(), password });
      // New accounts start PENDING — an admin must approve before first login.
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-xl">
          <View className="mb-lg h-20 w-20 items-center justify-center rounded-full border border-tertiary/30 bg-tertiary/10">
            <MaterialIcons name="hourglass-top" size={40} color={Palette.tertiary} />
          </View>
          <Text className="text-center font-inter-bold text-[24px] text-on-surface">
            Awaiting approval
          </Text>
          <Text className="mt-sm text-center font-inter text-[15px] leading-6 text-on-surface-variant">
            Your account has been created. An administrator must approve it before you can sign in.
            We&apos;ll let you in as soon as it&apos;s approved.
          </Text>
          <Pressable
            onPress={() => router.replace('/login')}
            className="mt-xl rounded-xl bg-primary px-xl py-md active:scale-[0.98]"
          >
            <Text className="font-inter-semibold text-[16px] text-on-primary">Back to Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

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
          <View className="mb-lg items-center">
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
            <Text className="font-inter-semibold text-[22px] text-on-surface">
              Create account
            </Text>
            <Text className="mt-xs font-inter text-[14px] text-on-surface-variant">
              Sign up to get started with Dipanix.
            </Text>

            {error && (
              <View className="mt-md rounded-lg border border-error/30 bg-error/10 p-md">
                <Text className="font-inter text-[13px] text-error">{error}</Text>
              </View>
            )}

            {/* Name */}
            <View className="mt-lg">
              <Text className="ml-xs font-inter-medium text-[14px] text-on-surface">Name</Text>
              <View className="mt-sm flex-row items-center rounded-lg border border-white/10 bg-surface-container-lowest px-md">
                <MaterialIcons name="person-outline" size={20} color={Palette.outline} />
                <TextInput
                  className="ml-sm flex-1 py-md font-inter text-[16px] text-on-surface"
                  placeholder="Your name"
                  placeholderTextColor={`${Palette.outline}99`}
                  autoCapitalize="words"
                  autoComplete="name"
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

            {/* Email */}
            <View className="mt-lg">
              <Text className="ml-xs font-inter-medium text-[14px] text-on-surface">Email</Text>
              <View className="mt-sm flex-row items-center rounded-lg border border-white/10 bg-surface-container-lowest px-md">
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
              <Text className="ml-xs font-inter-medium text-[14px] text-on-surface">Password</Text>
              <View className="mt-sm flex-row items-center rounded-lg border border-white/10 bg-surface-container-lowest px-md">
                <MaterialIcons name="lock-outline" size={20} color={Palette.outline} />
                <TextInput
                  className="ml-sm flex-1 py-md font-inter text-[16px] text-on-surface"
                  placeholder={`At least ${MIN_PASSWORD} characters`}
                  placeholderTextColor={`${Palette.outline}99`}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password-new"
                  value={password}
                  onChangeText={setPassword}
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

            {/* Confirm password */}
            <View className="mt-lg">
              <Text className="ml-xs font-inter-medium text-[14px] text-on-surface">
                Confirm password
              </Text>
              <View
                className={`mt-sm flex-row items-center rounded-lg border bg-surface-container-lowest px-md ${
                  confirmMismatch ? 'border-error/60' : 'border-white/10'
                }`}
              >
                <MaterialIcons name="lock-outline" size={20} color={Palette.outline} />
                <TextInput
                  className="ml-sm flex-1 py-md font-inter text-[16px] text-on-surface"
                  placeholder="Re-enter your password"
                  placeholderTextColor={`${Palette.outline}99`}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password-new"
                  value={confirm}
                  onChangeText={setConfirm}
                  onSubmitEditing={signUp}
                  returnKeyType="go"
                />
                {passwordsMatch && (
                  <MaterialIcons name="check-circle" size={20} color={Palette.tertiary} />
                )}
              </View>
              {confirmMismatch && (
                <Text className="ml-xs mt-xs font-inter text-[12px] text-error">
                  Passwords don&apos;t match.
                </Text>
              )}
            </View>

            {/* Create account */}
            <Pressable
              onPress={signUp}
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
                  {submitting ? 'Creating…' : 'Create Account'}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Footer */}
          <View className="mt-xl flex-row items-center justify-center">
            <Text className="font-inter text-[14px] text-on-surface-variant">
              Already have an account?{' '}
            </Text>
            <Pressable hitSlop={8} onPress={() => router.replace('/login')}>
              <Text className="font-inter-bold text-[14px] text-primary">Sign In</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
