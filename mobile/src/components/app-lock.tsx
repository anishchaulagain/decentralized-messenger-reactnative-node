import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, Text, View } from 'react-native';

import { useAuth } from '@/context/auth';
import { authenticate, isBiometricLockEnabled } from '@/lib/biometrics';
import { Palette } from '@/constants/palette';

/**
 * Biometric app lock. When the user has enabled it (Settings), the app is gated
 * behind a Face ID / fingerprint / passcode check on launch and whenever it
 * returns from the background. Rendered at the root so it covers everything.
 */
export function AppLock() {
  const { session, ready, signOut } = useAuth();
  const [locked, setLocked] = useState(false);
  const authing = useRef(false);
  const appState = useRef(AppState.currentState);

  const tryUnlock = useCallback(async () => {
    if (authing.current) return;
    authing.current = true;
    try {
      const ok = await authenticate('Unlock Dipanix');
      if (ok) setLocked(false);
    } finally {
      authing.current = false;
    }
  }, []);

  // Lock on startup if enabled and signed in.
  useEffect(() => {
    if (!ready || !session) return;
    let active = true;
    isBiometricLockEnabled().then((enabled) => {
      if (active && enabled) setLocked(true);
    });
    return () => {
      active = false;
    };
  }, [ready, session]);

  // Prompt as soon as we enter the locked state.
  useEffect(() => {
    if (locked) void tryUnlock();
  }, [locked, tryUnlock]);

  // Re-lock when backgrounded; re-prompt when coming back to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const prev = appState.current;
      appState.current = next;
      if (!session) return;
      if (/inactive|background/.test(next)) {
        if (await isBiometricLockEnabled()) setLocked(true);
      } else if (next === 'active' && /inactive|background/.test(prev) && locked) {
        void tryUnlock();
      }
    });
    return () => sub.remove();
  }, [session, locked, tryUnlock]);

  if (!locked || !session) return null;

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={() => undefined}>
      <View className="flex-1 items-center justify-center bg-background px-container-padding">
        <View
          className="h-24 w-24 items-center justify-center rounded-full border border-primary/20 bg-surface-container-high"
          style={{ shadowColor: Palette.primary, shadowOpacity: 0.25, shadowRadius: 30, elevation: 8 }}
        >
          <MaterialIcons name="lock" size={44} color={Palette.primary} />
        </View>
        <Text className="mt-lg font-inter-bold text-[22px] text-on-surface">Dipanix is locked</Text>
        <Text className="mt-sm text-center font-inter text-[14px] text-on-surface-variant">
          Authenticate to continue.
        </Text>

        <Pressable
          onPress={tryUnlock}
          className="mt-xl flex-row items-center gap-sm rounded-full bg-primary px-xl py-md active:scale-95"
        >
          <MaterialIcons name="fingerprint" size={22} color={Palette.onPrimary} />
          <Text className="font-inter-semibold text-[16px] text-on-primary">Unlock</Text>
        </Pressable>

        <Pressable onPress={() => signOut()} className="mt-lg py-sm active:opacity-70">
          <Text className="font-inter-semibold text-[14px] text-outline">Log out instead</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
