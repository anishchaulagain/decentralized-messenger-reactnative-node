import { MaterialIcons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { useCall } from '@/context/call';
import { Palette } from '@/constants/palette';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function RoundButton({
  icon,
  onPress,
  bg,
  color = '#ffffff',
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  bg: string;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="h-16 w-16 items-center justify-center rounded-full active:scale-90"
      style={{ backgroundColor: bg }}
    >
      <MaterialIcons name={icon} size={28} color={color} />
    </Pressable>
  );
}

export function CallOverlay() {
  const call = useCall();
  const {
    phase,
    type,
    contact,
    localStream,
    remoteStream,
    muted,
    cameraOff,
    durationSec,
  } = call;

  if (phase === 'idle' || phase === 'ended') return null;

  const isVideo = type === 'VIDEO';
  const statusLabel =
    phase === 'incoming'
      ? `Incoming ${isVideo ? 'video' : 'voice'} call`
      : phase === 'outgoing'
        ? 'Calling…'
        : phase === 'connecting'
          ? 'Connecting…'
          : fmt(durationSec);

  const showVideo = isVideo && phase === 'active';

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={call.hangup}>
      <View className="flex-1 bg-background">
        {/* Remote video fills the screen when connected; otherwise a calm avatar view */}
        {showVideo && remoteStream ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            objectFit="cover"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        ) : (
          <>
            <View className="absolute left-[-10%] top-[-10%] h-1/2 w-1/2 rounded-full bg-primary/10" />
            <View className="absolute bottom-[-10%] right-[-10%] h-1/2 w-2/5 rounded-full bg-secondary/10" />
          </>
        )}

        {/* Local self-view (video only) */}
        {showVideo && localStream && !cameraOff && (
          <View className="absolute right-4 top-16 h-40 w-28 overflow-hidden rounded-2xl border border-white/20">
            <RTCView
              streamURL={localStream.toURL()}
              objectFit="cover"
              mirror
              zOrder={1}
              style={{ flex: 1 }}
            />
          </View>
        )}

        <SafeAreaView className="flex-1 justify-between">
          {/* Caller identity */}
          <View className="mt-xl items-center px-container-padding">
            {!showVideo && (
              <Avatar
                uri={`https://i.pravatar.cc/150?u=${contact?.id ?? ''}`}
                size={120}
                showStatus={false}
              />
            )}
            <Text
              className="mt-lg font-inter-bold text-[26px] text-on-surface"
              style={showVideo ? { textShadowColor: '#000', textShadowRadius: 8 } : undefined}
            >
              {contact?.name ?? 'Unknown'}
            </Text>
            <View className="mt-xs flex-row items-center gap-xs">
              <MaterialIcons name="lock" size={14} color={Palette.tertiary} />
              <Text className="font-inter-semibold text-[14px] text-tertiary">{statusLabel}</Text>
            </View>
          </View>

          {/* Controls */}
          <View className="mb-xl px-container-padding">
            {phase === 'active' || phase === 'outgoing' || phase === 'connecting' ? (
              <>
                <View className="mb-lg flex-row justify-center gap-lg">
                  <RoundButton
                    icon={muted ? 'mic-off' : 'mic'}
                    onPress={call.toggleMute}
                    bg={muted ? Palette.primary : 'rgba(255,255,255,0.12)'}
                    color={muted ? Palette.onPrimary : '#fff'}
                  />
                  {isVideo && (
                    <>
                      <RoundButton
                        icon={cameraOff ? 'videocam-off' : 'videocam'}
                        onPress={call.toggleCamera}
                        bg={cameraOff ? Palette.primary : 'rgba(255,255,255,0.12)'}
                        color={cameraOff ? Palette.onPrimary : '#fff'}
                      />
                      <RoundButton
                        icon="flip-camera-ios"
                        onPress={call.switchCamera}
                        bg="rgba(255,255,255,0.12)"
                      />
                    </>
                  )}
                </View>
                <View className="items-center">
                  <RoundButton icon="call-end" onPress={call.hangup} bg={Palette.error} color="#3a0905" />
                </View>
              </>
            ) : (
              // Incoming: accept / decline
              <View className="flex-row justify-around">
                <View className="items-center gap-sm">
                  <RoundButton icon="call-end" onPress={call.reject} bg={Palette.error} color="#3a0905" />
                  <Text className="font-inter text-[13px] text-on-surface-variant">Decline</Text>
                </View>
                <View className="items-center gap-sm">
                  <RoundButton icon="call" onPress={call.accept} bg={Palette.tertiary} color={Palette.onTertiary} />
                  <Text className="font-inter text-[13px] text-on-surface-variant">Accept</Text>
                </View>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
