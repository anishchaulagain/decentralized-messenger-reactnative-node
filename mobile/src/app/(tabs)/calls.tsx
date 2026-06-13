import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { useCall } from '@/context/call';
import { callsApi, type CallLogEntry } from '@/lib/api';
import { avatarUri } from '@/lib/avatar';
import { Palette } from '@/constants/palette';

function fmtDuration(sec: number): string {
  if (sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function CallRow({ call, onCallBack }: { call: CallLogEntry; onCallBack: (type: 'AUDIO' | 'VIDEO') => void }) {
  const missed = call.status === 'MISSED' || call.status === 'REJECTED';
  const icon = missed ? 'call-missed' : call.direction === 'outgoing' ? 'call-made' : 'call-received';
  const iconColor = missed ? Palette.error : call.direction === 'outgoing' ? Palette.tertiary : Palette.primary;
  const duration = fmtDuration(call.duration);

  return (
    <View className="flex-row items-center rounded-xl p-md">
      <Avatar uri={avatarUri(call.contact)} size={52} showStatus={false} />
      <View className="ml-md min-w-0 flex-1">
        <Text
          className={`font-inter-bold text-[16px] ${missed ? 'text-error' : 'text-on-surface'}`}
          numberOfLines={1}
        >
          {call.contact.name}
        </Text>
        <View className="mt-xs flex-row items-center gap-xs">
          <MaterialIcons name={icon} size={16} color={iconColor} />
          <MaterialIcons
            name={call.type === 'VIDEO' ? 'videocam' : 'call'}
            size={14}
            color={Palette.outline}
          />
          <Text className="font-inter text-[13px] text-outline" numberOfLines={1}>
            {fmtWhen(call.createdAt)}
            {duration ? ` • ${duration}` : ''}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={() => onCallBack(call.type)}
        disabled={!call.contact.publicKey}
        className="h-10 w-10 items-center justify-center rounded-full bg-primary/10 active:scale-90"
        style={{ opacity: call.contact.publicKey ? 1 : 0.4 }}
      >
        <MaterialIcons name={call.type === 'VIDEO' ? 'videocam' : 'call'} size={20} color={Palette.primary} />
      </Pressable>
    </View>
  );
}

export default function CallsScreen() {
  const router = useRouter();
  const call = useCall();
  const [calls, setCalls] = useState<CallLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { calls: list } = await callsApi.list();
      setCalls(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load calls');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="h-16 flex-row items-center border-b border-white/5 px-container-padding">
        <Text className="font-inter-bold text-[20px] text-primary">Calls</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Palette.primary} />
        </View>
      ) : (
        <FlatList
          data={calls}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-xs pb-28 pt-sm"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={Palette.primary}
            />
          }
          ListEmptyComponent={
            <View className="mt-32 items-center px-xl">
              <MaterialIcons name="call" size={40} color={Palette.outline} />
              <Text className="mt-md text-center font-inter text-[15px] text-on-surface-variant">
                {error ?? 'No calls yet. Open a chat and tap the call button to start one.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <CallRow
              call={item}
              onCallBack={(type) => call.startCall(item.conversationId, item.contact, type)}
            />
          )}
        />
      )}

      {/* Start a call: pick a conversation from Chats */}
      <Pressable
        onPress={() => router.push('/(tabs)/chats')}
        className="absolute bottom-6 right-container-padding h-14 w-14 items-center justify-center rounded-2xl active:scale-90"
        style={{
          backgroundColor: Palette.primary,
          shadowColor: Palette.primary,
          shadowOpacity: 0.4,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
          elevation: 10,
        }}
      >
        <MaterialIcons name="add-call" size={26} color={Palette.onPrimary} />
      </Pressable>
    </SafeAreaView>
  );
}
