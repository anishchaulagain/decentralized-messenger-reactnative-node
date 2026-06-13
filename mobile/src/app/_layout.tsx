import '../global.css';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '@/context/auth';
import { Palette } from '@/constants/palette';

SplashScreen.preventAutoHideAsync();

const PROTECTED_ROOTS = ['(tabs)', 'chat', 'verify', 'new-chat', 'requests', 'backup-key'];

function RootNavigator() {
  const { session, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Bounce out of protected screens if the session is gone (e.g. after logout).
  useEffect(() => {
    if (!ready) return;
    const root = segments[0];
    if (!session && root && PROTECTED_ROOTS.includes(root)) {
      router.replace('/login');
    }
  }, [ready, session, segments, router]);

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
      <StatusBar style="light" />
      <RootNavigator />
    </AuthProvider>
  );
}
