import '../global.css';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text, TextInput } from 'react-native';

import { AppLock } from '@/components/app-lock';
import { CallOverlay } from '@/components/call-overlay';
import { AuthProvider, useAuth } from '@/context/auth';
import { CallProvider } from '@/context/call';
import { notificationTargetFromResponse, type NotificationTarget } from '@/lib/notifications';
import { Palette } from '@/constants/palette';

SplashScreen.preventAutoHideAsync();

// --- Cross-device UI uniformity ---
// Render text at its designed dp sizes on every device by ignoring the OS
// font-size (accessibility) setting — otherwise the same screen looks different
// on phones configured with larger/smaller system text. Purely visual; nothing
// functional changes. (RN already handles screen density, so this is the main
// remaining source of cross-device divergence.)
type WithDefaults = { defaultProps?: Record<string, unknown> };
(Text as unknown as WithDefaults).defaultProps = {
  ...(Text as unknown as WithDefaults).defaultProps,
  allowFontScaling: false,
};
(TextInput as unknown as WithDefaults).defaultProps = {
  ...(TextInput as unknown as WithDefaults).defaultProps,
  allowFontScaling: false,
};

const PROTECTED_ROOTS = ['(tabs)', 'chat', 'verify', 'new-chat', 'requests', 'backup-key'];

function RootNavigator() {
  const { session, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  // Where a tapped notification wants to go; navigated once we're ready and
  // signed in (the targets are protected routes).
  const [pendingTarget, setPendingTarget] = useState<NotificationTarget | null>(null);

  // Bounce out of protected screens if the session is gone (e.g. after logout).
  useEffect(() => {
    if (!ready) return;
    const root = segments[0];
    if (!session && root && PROTECTED_ROOTS.includes(root)) {
      router.replace('/login');
    }
  }, [ready, session, segments, router]);

  // Route to the relevant screen when the user taps a notification — both while
  // the app is running and when it was launched cold by the tap.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const target = notificationTargetFromResponse(response);
      if (target) setPendingTarget(target);
    });
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const target = notificationTargetFromResponse(response);
      if (target) setPendingTarget(target);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (pendingTarget && ready && session) {
      if (pendingTarget.kind === 'chat') router.push(`/chat/${pendingTarget.conversationId}`);
      else router.push('/requests');
      setPendingTarget(null);
    }
  }, [pendingTarget, ready, session, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Palette.background },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="restore-key" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="new-chat" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="requests" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="backup-key" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="verify/[id]" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <CallProvider>
        <StatusBar style="light" />
        <RootNavigator />
        <CallOverlay />
        <AppLock />
      </CallProvider>
    </AuthProvider>
  );
}
