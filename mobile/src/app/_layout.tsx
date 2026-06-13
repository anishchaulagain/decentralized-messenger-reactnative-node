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

import { AuthProvider, useAuth } from '@/context/auth';
import { conversationIdFromResponse } from '@/lib/notifications';
import { Palette } from '@/constants/palette';

SplashScreen.preventAutoHideAsync();

const PROTECTED_ROOTS = ['(tabs)', 'chat', 'verify', 'new-chat', 'requests', 'backup-key'];

function RootNavigator() {
  const { session, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  // Conversation a tapped notification wants to open; navigated once we're
  // ready and signed in (chat is a protected route).
  const [pendingChat, setPendingChat] = useState<string | null>(null);

  // Bounce out of protected screens if the session is gone (e.g. after logout).
  useEffect(() => {
    if (!ready) return;
    const root = segments[0];
    if (!session && root && PROTECTED_ROOTS.includes(root)) {
      router.replace('/login');
    }
  }, [ready, session, segments, router]);

  // Open the relevant chat when the user taps a message notification — both
  // while the app is running and when it was launched cold by the tap.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const id = conversationIdFromResponse(response);
      if (id) setPendingChat(id);
    });
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const id = conversationIdFromResponse(response);
      if (id) setPendingChat(id);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (pendingChat && ready && session) {
      router.push(`/chat/${pendingChat}`);
      setPendingChat(null);
    }
  }, [pendingChat, ready, session, router]);

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
