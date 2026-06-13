import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { requestsApi, type MessageRequest } from '@/lib/api';
import { onSocket } from '@/lib/socket';
import { Palette } from '@/constants/palette';

export default function RequestsScreen() {
  const router = useRouter();
  const [incoming, setIncoming] = useState<MessageRequest[]>([]);
  const [outgoing, setOutgoing] = useState<MessageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [inc, out] = await Promise.all([requestsApi.incoming(), requestsApi.outgoing()]);
      setIncoming(inc.requests);
      setOutgoing(out.requests);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Live-refresh while the screen is open if a request arrives or is answered.
  useEffect(() => {
    const unsubs = [
      onSocket('request:new', () => load()),
      onSocket('request:accepted', () => load()),
    ];
    return () => unsubs.forEach((off) => off());
  }, [load]);

  const accept = async (req: MessageRequest) => {
    setBusyId(req.id);
    try {
      const { conversation } = await requestsApi.accept(req.id);
      router.replace(`/chat/${conversation.id}`);
    } catch {
      setBusyId(null);
    }
  };

  const reject = async (req: MessageRequest) => {
    setBusyId(req.id);
    try {
      await requestsApi.reject(req.id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="h-16 flex-row items-center gap-md border-b border-white/5 px-container-padding">
        <Pressable onPress={() => router.back()} className="-ml-2 h-10 w-10 items-center justify-center active:scale-95">
          <MaterialIcons name="arrow-back-ios-new" size={20} color={Palette.primary} />
        </Pressable>
        <Text className="font-inter-semibold text-[18px] text-on-surface">Requests</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Palette.primary} />
        </View>
      ) : (
        <ScrollView contentContainerClassName="px-container-padding pb-xl pt-lg">
          {/* Incoming */}
          <Text className="mb-sm font-inter-semibold text-[12px] uppercase tracking-widest text-outline">
            Incoming
          </Text>
          {incoming.length === 0 ? (
            <Text className="mb-lg font-inter text-[14px] text-on-surface-variant">
              No pending requests.
            </Text>
          ) : (
            incoming.map((req) => (
              <View
                key={req.id}
                className="mb-sm flex-row items-center rounded-xl border border-white/10 bg-white/5 p-md"
              >
                <Avatar uri={`https://i.pravatar.cc/150?u=${req.requester?.id}`} size={44} showStatus={false} />
                <View className="ml-md flex-1">
                  <Text className="font-inter-bold text-[15px] text-on-surface">{req.requester?.name}</Text>
                  <Text className="font-inter text-[12px] text-on-surface-variant">{req.requester?.email}</Text>
                </View>
                <View className="flex-row items-center gap-sm">
                  <Pressable
                    onPress={() => reject(req)}
                    disabled={busyId === req.id}
                    className="h-9 w-9 items-center justify-center rounded-full bg-surface-container-high active:scale-90"
                  >
                    <MaterialIcons name="close" size={20} color={Palette.error} />
                  </Pressable>
                  <Pressable
                    onPress={() => accept(req)}
                    disabled={busyId === req.id}
                    className="h-9 w-9 items-center justify-center rounded-full bg-tertiary active:scale-90"
                  >
                    <MaterialIcons name="check" size={20} color={Palette.onTertiary} />
                  </Pressable>
                </View>
              </View>
            ))
          )}

          {/* Outgoing */}
          <Text className="mb-sm mt-lg font-inter-semibold text-[12px] uppercase tracking-widest text-outline">
            Sent
          </Text>
          {outgoing.length === 0 ? (
            <Text className="font-inter text-[14px] text-on-surface-variant">
              You haven&apos;t sent any requests.
            </Text>
          ) : (
            outgoing.map((req) => (
              <View
                key={req.id}
                className="mb-sm flex-row items-center rounded-xl border border-white/10 bg-white/5 p-md"
              >
                <Avatar uri={`https://i.pravatar.cc/150?u=${req.recipient?.id}`} size={44} showStatus={false} />
                <View className="ml-md flex-1">
                  <Text className="font-inter-bold text-[15px] text-on-surface">{req.recipient?.name}</Text>
                  <Text className="font-inter text-[12px] text-on-surface-variant">{req.recipient?.email}</Text>
                </View>
                <Text
                  className={`font-inter-semibold text-[12px] ${
                    req.status === 'ACCEPTED'
                      ? 'text-tertiary'
                      : req.status === 'REJECTED'
                        ? 'text-error'
                        : 'text-outline'
                  }`}
                >
                  {req.status.toLowerCase()}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
