// Base URL of the Dipanix backend.
//
// Set EXPO_PUBLIC_API_URL when running on a device/emulator that can't reach
// "localhost" on your dev machine:
//   - Android emulator: http://10.0.2.2:3000
//   - Physical device:  http://<your-LAN-IP>:3000  (e.g. http://192.168.1.20:3000)
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
