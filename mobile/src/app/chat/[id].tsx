import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { useAuth } from '@/context/auth';
import { conversationsApi, type ConversationSummary, type PublicUser } from '@/lib/api';
import { encryptMessage } from '@/lib/crypto';
import { decryptForMe } from '@/lib/messages';
import { Palette } from '@/constants/palette';

interface DisplayMessage {
  id: string;
  text: string;
  time: string;
  outgoing: boolean;
  read: boolean;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function Bubble({ message }: { message: DisplayMessage }) {
  if (message.outgoing) {
    return (
      <View className="mb-md max-w-[85%] items-end self-end">
        <LinearGradient
          colors={[Palette.primaryContainer, Palette.secondaryContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 16, borderTopRightRadius: 4, paddingHorizontal: 16, paddingVertical: 10 }}
        >
          <Text className="font-inter text-[16px] leading-6 text-white">{message.text}</Text>
        </LinearGradient>
        <View className="mt-xs flex-row items-center gap-xs">
          <Text className="font-inter-semibold text-[12px] text-outline opacity-60">{message.time}</Text>
          {message.read && <MaterialIcons name="done-all" size={14} color={Palette.primary} />}
        </View>
      </View>
    );
  }
  return (
    <View className="mb-md max-w-[85%] self-start">
      <View className="rounded-2xl rounded-tl border border-white/5 bg-surface-container-high px-md py-sm">
        <Text className="font-inter text-[16px] leading-6 text-on-surface">{message.text}</Text>
      </View>
      <Text className="ml-1 mt-xs font-inter-semibold text-[12px] text-outline opacity-60">
        {message.time}
      </Text>
    </View>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const myId = session?.user.id ?? '';

  const [contact, setContact] = useState<PublicUser | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const loadMessages = useCallback(async () => {
    if (!id) return;
    try {
      const { messages: encrypted } = await conversationsApi.messages(id);
      const decrypted = await Promise.all(
        encrypted.map(async (m) => ({
          id: m.id,
          text: (await decryptForMe(m, myId)) ?? '🔒 Unable to decrypt',
          time: formatTime(m.createdAt),
          outgoing: m.senderId === myId,
          read: m.readAt != null,
        })),
      );
      setMessages(decrypted);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load messages');
    }
  }, [id, myId]);

  // Load the contact (from the conversation list) once.
  useEffect(() => {
    let active = true;
    conversationsApi
      .list()
      .then(({ conversations }) => {
        const convo = conversations.find((c: ConversationSummary) => c.id === id);
        if (active && convo) setContact(convo.contact);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [id]);

  // Initial load + light polling for incoming messages while focused.
  useEffect(() => {
    let active = true;
    loadMessages().finally(() => {
      if (active) setLoading(false);
    });
    const timer = setInterval(loadMessages, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [loadMessages]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending || !id) return;
    if (!contact?.publicKey) {
      setError('This contact has not set up encryption yet.');
      return;
    }
    setSending(true);
    try {
      const { ciphertext, nonce } = await encryptMessage(text, contact.publicKey);
      await conversationsApi.send(id, ciphertext, nonce);
      setDraft('');
      await loadMessages();
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="h-16 flex-row items-center gap-md border-b border-white/5 bg-surface-container/70 px-container-padding">
        <Pressable onPress={() => router.back()} className="-ml-2 h-10 w-10 items-center justify-center active:scale-95">
          <MaterialIcons name="arrow-back-ios-new" size={20} color={Palette.primary} />
        </Pressable>
        <Avatar uri={`https://i.pravatar.cc/150?u=${contact?.id ?? id}`} size={40} showStatus={false} />
        <View className="min-w-0 flex-1">
          <Text className="font-inter-semibold text-[18px] text-on-surface" numberOfLines={1}>
            {contact?.name ?? 'Chat'}
          </Text>
          <Text className="font-inter-semibold text-[12px] text-tertiary">End-to-end encrypted</Text>
        </View>
        <Pressable
          onPress={() => router.push(`/verify/${id}`)}
          className="h-10 w-10 items-center justify-center active:scale-90"
        >
          <MaterialIcons name="verified-user" size={22} color={Palette.tertiary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior="padding">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={Palette.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerClassName="px-container-padding pb-md pt-sm"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View className="mt-32 items-center">
                <Text className="font-inter text-[14px] text-on-surface-variant">
                  No messages yet. Say hello — it&apos;s end-to-end encrypted.
                </Text>
              </View>
            }
            renderItem={({ item }) => <Bubble message={item} />}
          />
        )}

        {error && (
          <Text className="px-container-padding pb-xs text-center font-inter text-[12px] text-error">
            {error}
          </Text>
        )}

        {/* Input bar */}
        <View className="flex-row items-center gap-md border-t border-white/5 bg-surface-container/70 px-container-padding py-md">
          <View className="h-12 flex-1 flex-row items-center rounded-full border border-white/5 bg-surface-container-lowest px-md">
            <TextInput
              className="flex-1 font-inter text-[16px] text-on-surface"
              placeholder="Type a message…"
              placeholderTextColor={Palette.outline}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={send}
              returnKeyType="send"
            />
          </View>
          <Pressable onPress={send} disabled={sending} className="active:scale-90" style={{ opacity: sending ? 0.6 : 1 }}>
            <LinearGradient
              colors={[Palette.primaryContainer, Palette.secondaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
            >
              <MaterialIcons name="send" size={22} color="#ffffff" />
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
