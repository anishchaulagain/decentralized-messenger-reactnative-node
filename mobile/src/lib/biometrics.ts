// Optional biometric app lock (Face ID / Touch ID / fingerprint).
//
// When enabled, the app requires a biometric (or device passcode) check on
// launch and when returning from the background. This is a local device gate
// only — it does not change auth tokens or anything server-side.
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const ENABLED_KEY = 'dipanix.biometricLock';

/** Whether the device has biometric hardware AND the user has enrolled. */
export async function isBiometricAvailable(): Promise<boolean> {
  const [hasHardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && enrolled;
}

/** A human label for the primary supported biometric (for UI copy). */
export async function biometricLabel(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Fingerprint';
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'Iris';
  return 'Biometrics';
}

/** Whether the user has turned the biometric lock on. */
export async function isBiometricLockEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ENABLED_KEY)) === 'true';
}

export async function setBiometricLockEnabled(enabled: boolean): Promise<void> {
  if (enabled) await SecureStore.setItemAsync(ENABLED_KEY, 'true');
  else await SecureStore.deleteItemAsync(ENABLED_KEY);
}

/**
 * Prompts for biometric (or device-passcode) authentication. Returns true on
 * success. Used both to confirm enabling the lock and to unlock the app.
 */
export async function authenticate(prompt = 'Unlock Dipanix'): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: prompt,
    // Allow falling back to the device PIN/passcode if biometrics fail.
    disableDeviceFallback: false,
    cancelLabel: 'Cancel',
  });
  return result.success;
}
