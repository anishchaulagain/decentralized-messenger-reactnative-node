// 1:1 voice/video calling over WebRTC.
//
// The media is peer-to-peer and encrypted by WebRTC itself (DTLS-SRTP). The
// signaling (SDP offer/answer + ICE candidates) is relayed by our server, but
// each payload is sealed with the recipient's NaCl key (encryptPayload), so the
// server forwards opaque blobs and cannot read or tamper with them — the DTLS
// fingerprint inside the SDP is therefore bound to the identity the users verify
// via their safety number. The server only learns who called whom and when.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  mediaDevices,
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
} from 'react-native-webrtc';

import { useAuth } from '@/context/auth';
import { callsApi, conversationsApi, type CallStatus, type CallType, type PublicUser } from '@/lib/api';
import { ICE_SERVERS } from '@/lib/config';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { emitSocket, onSocket } from '@/lib/socket';

type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended';

interface CallState {
  phase: CallPhase;
  type: CallType;
  contact: PublicUser | null;
  conversationId: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  cameraOff: boolean;
  durationSec: number;
}

interface CallContextValue extends CallState {
  startCall: (conversationId: string, contact: PublicUser, type: CallType) => Promise<void>;
  accept: () => Promise<void>;
  reject: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  switchCamera: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

const IDLE: CallState = {
  phase: 'idle',
  type: 'AUDIO',
  contact: null,
  conversationId: null,
  localStream: null,
  remoteStream: null,
  muted: false,
  cameraOff: false,
  durationSec: 0,
};

const RING_TIMEOUT_MS = 35_000;

export function CallProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const myId = session?.user.id ?? '';

  const [state, setState] = useState<CallState>(IDLE);

  // Mutable call internals (kept in refs so handlers always see the latest).
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const callId = useRef<string | null>(null);
  const convId = useRef<string | null>(null);
  const peerKey = useRef<string | null>(null); // counterparty public key
  const isCaller = useRef(false);
  const callType = useRef<CallType>('AUDIO');
  const pendingIce = useRef<RTCIceCandidate[]>([]);
  const remoteReady = useRef(false);
  const connectedOnce = useRef(false);
  const pendingOffer = useRef<{ type: string; sdp: string } | null>(null);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  // Lets event handlers built in setupPeer invoke the latest hangup().
  const hangupRef = useRef<() => void>(() => {});

  // Tear everything down and (if we placed the call) record it in history.
  const cleanup = useCallback(
    (status: CallStatus | null) => {
      if (ringTimer.current) clearTimeout(ringTimer.current);
      if (durationTimer.current) clearInterval(durationTimer.current);
      ringTimer.current = null;
      durationTimer.current = null;

      localStream.current?.getTracks().forEach((t) => t.stop());
      if (pc.current) {
        try {
          pc.current.close();
        } catch {
          // already closed
        }
      }

      const duration = connectedOnce.current ? Math.floor((Date.now() - startedAt.current) / 1000) : 0;
      const shouldLog = isCaller.current && status && convId.current;
      if (shouldLog) {
        void callsApi
          .log({ conversationId: convId.current!, type: callType.current, status, duration })
          .catch(() => undefined);
      }

      pc.current = null;
      localStream.current = null;
      callId.current = null;
      convId.current = null;
      peerKey.current = null;
      isCaller.current = false;
      pendingIce.current = [];
      remoteReady.current = false;
      connectedOnce.current = false;
      pendingOffer.current = null;
      startedAt.current = 0;

      setState(IDLE);
    },
    [],
  );

  // Builds the peer connection, wires events, and attaches the local media.
  const setupPeer = useCallback(
    async (type: CallType): Promise<MediaStream> => {
      const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pc.current = connection;

      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: type === 'VIDEO' ? { facingMode: 'user' } : false,
      });
      localStream.current = stream;
      stream.getTracks().forEach((track) => connection.addTrack(track, stream));

      // Trickle our ICE candidates to the peer (encrypted).
      (connection as any).onicecandidate = (event: any) => {
        if (event.candidate && peerKey.current && convId.current && callId.current) {
          void encryptPayload(event.candidate, peerKey.current).then((candidate) =>
            emitSocket('call:ice', {
              conversationId: convId.current,
              callId: callId.current,
              candidate,
            }),
          );
        }
      };

      (connection as any).ontrack = (event: any) => {
        const [remote] = event.streams;
        if (remote) setState((s) => ({ ...s, remoteStream: remote }));
      };

      (connection as any).onconnectionstatechange = () => {
        const cs = connection.connectionState;
        if (cs === 'connected' && !connectedOnce.current) {
          connectedOnce.current = true;
          startedAt.current = Date.now();
          if (ringTimer.current) clearTimeout(ringTimer.current);
          durationTimer.current = setInterval(
            () => setState((s) => ({ ...s, durationSec: Math.floor((Date.now() - startedAt.current) / 1000) })),
            1000,
          );
          setState((s) => ({ ...s, phase: 'active' }));
        } else if (cs === 'failed' || cs === 'closed' || cs === 'disconnected') {
          if (state.phase !== 'idle') hangupRef.current();
        }
      };

      setState((s) => ({ ...s, localStream: stream }));
      return stream;
    },
    [state.phase],
  );

  const flushPendingIce = useCallback(async () => {
    remoteReady.current = true;
    for (const c of pendingIce.current) {
      try {
        await pc.current?.addIceCandidate(c);
      } catch {
        // ignore malformed/late candidates
      }
    }
    pendingIce.current = [];
  }, []);

  // --- Outgoing ---
  const startCall = useCallback(
    async (conversationId: string, contact: PublicUser, type: CallType) => {
      if (state.phase !== 'idle') return;
      if (!contact.publicKey) return;

      callId.current = `${myId}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      convId.current = conversationId;
      peerKey.current = contact.publicKey;
      isCaller.current = true;
      callType.current = type;

      setState({ ...IDLE, phase: 'outgoing', type, contact, conversationId });

      try {
        await setupPeer(type);
        const offer = await pc.current!.createOffer({});
        await pc.current!.setLocalDescription(offer);
        const sdp = await encryptPayload({ type: offer.type, sdp: offer.sdp }, contact.publicKey);
        emitSocket('call:offer', {
          conversationId,
          callId: callId.current,
          callType: type === 'VIDEO' ? 'video' : 'audio',
          sdp,
        });
        ringTimer.current = setTimeout(() => cleanup('MISSED'), RING_TIMEOUT_MS);
      } catch {
        cleanup('CANCELED');
      }
    },
    [state.phase, setupPeer, cleanup, myId],
  );

  // --- Incoming: accept ---
  const accept = useCallback(async () => {
    if (state.phase !== 'incoming' || !pendingOffer.current || !peerKey.current) return;
    setState((s) => ({ ...s, phase: 'connecting' }));
    try {
      await setupPeer(callType.current);
      await pc.current!.setRemoteDescription(new RTCSessionDescription(pendingOffer.current));
      await flushPendingIce();
      const answer = await pc.current!.createAnswer();
      await pc.current!.setLocalDescription(answer);
      const sdp = await encryptPayload({ type: answer.type, sdp: answer.sdp }, peerKey.current);
      emitSocket('call:answer', { conversationId: convId.current, callId: callId.current, sdp });
    } catch {
      cleanup(null);
    }
  }, [state.phase, setupPeer, flushPendingIce, cleanup]);

  const reject = useCallback(() => {
    if (state.phase === 'incoming') {
      emitSocket('call:reject', { conversationId: convId.current, callId: callId.current });
    }
    cleanup(null); // the caller logs the rejected call
  }, [state.phase, cleanup]);

  const hangup = useCallback(() => {
    if (convId.current && callId.current && state.phase !== 'idle' && state.phase !== 'ended') {
      emitSocket('call:hangup', { conversationId: convId.current, callId: callId.current });
    }
    // Caller-side status: connected → ANSWERED, otherwise CANCELED.
    cleanup(connectedOnce.current ? 'ANSWERED' : 'CANCELED');
  }, [state.phase, cleanup]);

  // Keep the ref pointed at the latest hangup() for use inside peer handlers.
  useEffect(() => {
    hangupRef.current = hangup;
  }, [hangup]);

  const toggleMute = useCallback(() => {
    const tracks = localStream.current?.getAudioTracks() ?? [];
    const next = !state.muted;
    tracks.forEach((t) => (t.enabled = !next));
    setState((s) => ({ ...s, muted: next }));
  }, [state.muted]);

  const toggleCamera = useCallback(() => {
    const tracks = localStream.current?.getVideoTracks() ?? [];
    const next = !state.cameraOff;
    tracks.forEach((t) => (t.enabled = !next));
    setState((s) => ({ ...s, cameraOff: next }));
  }, [state.cameraOff]);

  const switchCamera = useCallback(() => {
    localStream.current?.getVideoTracks().forEach((t) => {
      // react-native-webrtc extension for flipping the camera.
      (t as any)._switchCamera?.();
    });
  }, []);

  // --- Signaling listeners ---
  useEffect(() => {
    if (!session) return;

    const offIncoming = onSocket('call:incoming', async (p: any) => {
      // Busy: decline a second incoming call.
      if (state.phase !== 'idle') {
        emitSocket('call:reject', { conversationId: p.conversationId, callId: p.callId });
        return;
      }
      // Resolve the caller's verified key + name from our conversation record.
      const { conversations } = await conversationsApi.list().catch(() => ({ conversations: [] }));
      const convo = conversations.find((c) => c.id === p.conversationId);
      if (!convo?.contact.publicKey) return;

      const offer = await decryptPayload<{ type: string; sdp: string }>(
        p.sdp.ciphertext,
        p.sdp.nonce,
        convo.contact.publicKey,
      );
      if (!offer) return;

      callId.current = p.callId;
      convId.current = p.conversationId;
      peerKey.current = convo.contact.publicKey;
      isCaller.current = false;
      callType.current = p.callType === 'video' ? 'VIDEO' : 'AUDIO';
      pendingOffer.current = offer;

      setState({
        ...IDLE,
        phase: 'incoming',
        type: callType.current,
        contact: convo.contact,
        conversationId: p.conversationId,
      });
      ringTimer.current = setTimeout(() => cleanup(null), RING_TIMEOUT_MS);
    });

    const offAnswer = onSocket('call:answer', async (p: any) => {
      if (!isCaller.current || p.callId !== callId.current || !peerKey.current) return;
      const answer = await decryptPayload<{ type: string; sdp: string }>(
        p.sdp.ciphertext,
        p.sdp.nonce,
        peerKey.current,
      );
      if (!answer) return;
      await pc.current?.setRemoteDescription(new RTCSessionDescription(answer));
      await flushPendingIce();
    });

    const offIce = onSocket('call:ice', async (p: any) => {
      if (p.callId !== callId.current || !peerKey.current) return;
      const cand = await decryptPayload<any>(p.candidate.ciphertext, p.candidate.nonce, peerKey.current);
      if (!cand) return;
      const candidate = new RTCIceCandidate(cand);
      if (remoteReady.current) {
        await pc.current?.addIceCandidate(candidate).catch(() => undefined);
      } else {
        pendingIce.current.push(candidate);
      }
    });

    const offReject = onSocket('call:reject', (p: any) => {
      if (p.callId === callId.current) cleanup(isCaller.current ? 'REJECTED' : null);
    });

    const offHangup = onSocket('call:hangup', (p: any) => {
      if (p.callId === callId.current) cleanup(isCaller.current ? 'ANSWERED' : null);
    });

    const offUnavailable = onSocket('call:unavailable', (p: any) => {
      if (p.callId === callId.current) cleanup('MISSED');
    });

    return () => {
      offIncoming();
      offAnswer();
      offIce();
      offReject();
      offHangup();
      offUnavailable();
    };
  }, [session, state.phase, flushPendingIce, cleanup]);

  const value: CallContextValue = {
    ...state,
    startCall,
    accept,
    reject,
    hangup,
    toggleMute,
    toggleCamera,
    switchCamera,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}
