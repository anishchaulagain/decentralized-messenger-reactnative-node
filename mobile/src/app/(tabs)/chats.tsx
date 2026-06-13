import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { useAuth } from '@/context/auth';
import { conversationsApi, requestsApi, type ConversationSummary } from '@/lib/api';
import { avatarUri } from '@/lib/avatar';
import { decryptForMe } from '@/lib/messages';
import { onSocket } from '@/lib/socket';
import { Palette } from '@/constants/palette';

function ChatRow({
  conversation,
  preview,
  onPress,
}: {
  conversation: ConversationSummary;
  preview: string;
  onPress: () => void;
}) {
  const hasUnread = conversation.unreadCount > 0;
  return (
    <Pressable onPress={onPress} className="flex-row items-center rounded-xl p-md active:bg-primary/5">
      <Avatar uri={avatarUri(conversation.contact)} size={56} showStatus={false} />
      <View className="ml-md min-w-0 flex-1">
        <View className="mb-1 flex-row items-baseline justify-between">
          <Text className="flex-1 font-inter-bold text-[16px] text-on-surface" numberOfLines={1}>
            {conversation.contact.name}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text
            className={`flex-1 pr-md font-inter text-[14px] ${hasUnread ? 'text-on-surface-variant' : 'text-outline'}`}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {hasUnread && (
            <View className="min-w-[20px] items-center rounded-full bg-primary px-1.5 py-0.5">
              <Text className="font-inter-semibold text-[12px] text-on-primary-container">
                {conversation.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function ChatsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const myId = session?.user.id ?? '';

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [incomingCount, setIncomingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      const [{ conversations: list }, { requests }] = await Promise.all([
        conversationsApi.list(),
        requestsApi.incoming(),
      ]);
      setConversations(list);
      setIncomingCount(requests.length);

      // Decrypt last-message previews.
      const entries = await Promise.all(
        list.map(async (c) => {
          if (!c.lastMessage) return [c.id, 'No messages yet'] as const;
          const text = await decryptForMe(c.lastMessage, myId);
          return [c.id, text ?? '🔒 Encrypted message'] as const;
        }),
      );
      setPreviews(Object.fromEntries(entries));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load chats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [myId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Live updates: refresh on new/changed messages, incoming or accepted
  // requests, or on (re)connect.
  useEffect(() => {
    const unsubs = [
      onSocket('message:new', () => load()),
      onSocket('message:updated', () => load()),
      onSocket('request:new', () => load()),
      onSocket('request:accepted', () => load()),
      onSocket('connect', () => load()),
    ];
    return () => unsubs.forEach((off) => off());
  }, [load]);

  const q = query.trim().toLowerCase();
  const visible = q
    ? conversations.filter(
        (c) =>
          c.contact.name.toLowerCase().includes(q) ||
          (previews[c.id] ?? '').toLowerCase().includes(q),
      )
    : conversations;

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Top app bar */}
      <View className="h-16 flex-row items-center justify-between border-b border-white/5 px-container-padding">
        <Text className="font-inter-bold text-[20px] text-primary">Messages</Text>
        <View className="flex-row items-center gap-sm">
          <Pressable
            onPress={() => router.push('/requests')}
            className="h-10 w-10 items-center justify-center active:opacity-80"
          >
            <MaterialIcons name="how-to-reg" size={24} color={Palette.primary} />
            {incomingCount > 0 && (
              <View className="absolute right-1 top-1 h-4 min-w-[16px] items-center justify-center rounded-full bg-error px-1">
                <Text className="font-inter-semibold text-[10px] text-white">{incomingCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.push('/new-chat')}
            className="h-10 w-10 items-center justify-center active:opacity-80"
          >
            <MaterialIcons name="search" size={24} color={Palette.primary} />
          </Pressable>
        </View>
      </View>

      {/* Search existing conversations */}
      {!loading && conversations.length > 0 && (
        <View className="px-container-padding pb-xs pt-sm">
          <View className="h-11 flex-row items-center gap-sm rounded-full border border-white/5 bg-surface-container-lowest px-md">
            <MaterialIcons name="search" size={18} color={Palette.outline} />
            <TextInput
              className="flex-1 font-inter text-[15px] text-on-surface"
              placeholder="Search conversations…"
              placeholderTextColor={Palette.outline}
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} className="active:scale-90">
                <MaterialIcons name="close" size={18} color={Palette.outline} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Palette.primary} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-xs pb-28 pt-sm"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.primary} />
          }
          ListEmptyComponent={
            <View className="mt-32 items-center px-xl">
              <MaterialIcons name="forum" size={40} color={Palette.outline} />
              <Text className="mt-md text-center font-inter text-[15px] text-on-surface-variant">
                {q
                  ? 'No conversations match your search.'
                  : (error ?? 'No conversations yet. Tap search to find someone by email.')}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ChatRow
              conversation={item}
              preview={previews[item.id] ?? '🔒 Encrypted message'}
              onPress={() => router.push(`/chat/${item.id}`)}
            />
          )}
        />
      )}

      {/* New chat FAB */}
      <Pressable onPress={() => router.push('/new-chat')} className="absolute bottom-6 right-container-padding active:scale-90">
        <LinearGradient
          colors={[Palette.primary, Palette.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: Palette.primary,
            shadowOpacity: 0.4,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 10 },
            elevation: 10,
          }}
        >
          <MaterialIcons name="add" size={30} color={Palette.onPrimaryContainer} />
        </LinearGradient>
      </Pressable>
    </SafeAreaView>
  );
}
