// Base URL of the Dipanix backend.
//
// Set EXPO_PUBLIC_API_URL when running on a device/emulator that can't reach
// "localhost" on your dev machine:
//   - Android emulator: http://10.0.2.2:3000
//   - Physical device:  http://<your-LAN-IP>:3000  (e.g. http://192.168.1.20:3000)
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// ICE servers for WebRTC calls. A public STUN server is enough for devices on
// the same network or behind friendly NATs; a TURN relay is required for
// reliable connectivity across mobile networks/symmetric NATs. Configure TURN
// via env (the relay only forwards already-encrypted media — it can't decrypt).
//   EXPO_PUBLIC_TURN_URL=turn:turn.example.com:3478
//   EXPO_PUBLIC_TURN_USERNAME=...   EXPO_PUBLIC_TURN_CREDENTIAL=...
export const ICE_SERVERS: { urls: string; username?: string; credential?: string }[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  ...(process.env.EXPO_PUBLIC_TURN_URL
    ? [
        {
          urls: process.env.EXPO_PUBLIC_TURN_URL,
          username: process.env.EXPO_PUBLIC_TURN_USERNAME,
          credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL,
        },
      ]
    : []),
];
