import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import { emitSocket, onSocket } from '@/lib/socket';
import { Palette } from '@/constants/palette';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface DisplayReaction {
  emoji: string;
  count: number;
  mine: boolean;
}

interface DisplayMessage {
  id: string;
  text: string;
  time: string;
  outgoing: boolean;
  read: boolean;
  edited: boolean;
  deleted: boolean;
  reactions: DisplayReaction[];
  reply: { text: string; outgoing: boolean } | null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function Reactions({
  reactions,
  outgoing,
  onToggle,
}: {
  reactions: DisplayReaction[];
  outgoing: boolean;
  onToggle: (emoji: string) => void;
}) {
  if (reactions.length === 0) return null;
  return (
    <View className={`mt-1 flex-row flex-wrap gap-1 ${outgoing ? 'justify-end' : ''}`}>
      {reactions.map((r) => (
        <Pressable
          key={r.emoji}
          onPress={() => onToggle(r.emoji)}
          className={`flex-row items-center gap-0.5 rounded-full border px-1.5 py-0.5 ${
            r.mine ? 'border-primary bg-primary/20' : 'border-white/5 bg-surface-container-high'
          }`}
        >
          <Text className="text-[12px]">{r.emoji}</Text>
          {r.count > 1 && (
            <Text className="font-inter-semibold text-[11px] text-on-surface-variant">{r.count}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

function Bubble({
  message,
  onLongPress,
  onToggleReaction,
}: {
  message: DisplayMessage;
  onLongPress: () => void;
  onToggleReaction: (emoji: string) => void;
}) {
  const align = message.outgoing ? 'items-end self-end' : 'self-start';

  const replyPreview = message.reply && (
    <View
      className={`mb-1 rounded-lg border-l-2 px-2 py-1 ${
        message.outgoing ? 'border-white/60 bg-white/10' : 'border-primary bg-surface-container-low'
      }`}
    >
      <Text className="font-inter-semibold text-[11px] text-primary-fixed-dim">
        {message.reply.outgoing ? 'You' : 'Them'}
      </Text>
      <Text className="font-inter text-[12px] text-on-surface-variant" numberOfLines={1}>
        {message.reply.text}
      </Text>
    </View>
  );

  const body = message.deleted ? (
    <Text className="font-inter text-[15px] italic text-on-surface-variant">
      🚫 This message was deleted
    </Text>
  ) : (
    <Text
      className={`font-inter text-[16px] leading-6 ${message.outgoing ? 'text-white' : 'text-on-surface'}`}
    >
      {message.text}
    </Text>
  );

  return (
    <View className={`mb-md max-w-[85%] ${align}`}>
      <Pressable onLongPress={onLongPress} delayLongPress={250}>
        {message.outgoing ? (
          <LinearGradient
            colors={[Palette.primaryContainer, Palette.secondaryContainer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 16, borderTopRightRadius: 4, paddingHorizontal: 16, paddingVertical: 10 }}
          >
            {replyPreview}
            {body}
          </LinearGradient>
        ) : (
          <View className="rounded-2xl rounded-tl border border-white/5 bg-surface-container-high px-md py-sm">
            {replyPreview}
            {body}
          </View>
        )}
      </Pressable>

      <Reactions reactions={message.reactions} outgoing={message.outgoing} onToggle={onToggleReaction} />

      <View className={`mt-xs flex-row items-center gap-xs ${message.outgoing ? '' : 'ml-1'}`}>
        <Text className="font-inter-semibold text-[12px] text-outline opacity-60">{message.time}</Text>
        {message.edited && !message.deleted && (
          <Text className="font-inter text-[11px] text-outline opacity-60">edited</Text>
        )}
        {message.outgoing && message.read && (
          <MaterialIcons name="done-all" size={14} color={Palette.primary} />
        )}
      </View>
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

  const [replyingTo, setReplyingTo] = useState<DisplayMessage | null>(null);
  const [editing, setEditing] = useState<DisplayMessage | null>(null);
  const [menuTarget, setMenuTarget] = useState<DisplayMessage | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const listRef = useRef<FlatList>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmit = useRef(0);

  const loadMessages = useCallback(async () => {
    if (!id) return;
    try {
      const { messages: encrypted } = await conversationsApi.messages(id);
      const decrypted = await Promise.all(
        encrypted.map(async (m): Promise<DisplayMessage> => {
          const deleted = m.deletedAt != null;
          const text = deleted
            ? ''
            : ((await decryptForMe(m, myId)) ?? '🔒 Unable to decrypt');

          let reply: DisplayMessage['reply'] = null;
          if (m.replyTo) {
            const rt = m.replyTo;
            const rText = rt.deletedAt
              ? 'Deleted message'
              : ((await decryptForMe(rt, myId)) ?? '🔒 Encrypted');
            reply = { text: rText, outgoing: rt.senderId === myId };
          }

          // Aggregate reactions by emoji.
          const byEmoji = new Map<string, DisplayReaction>();
          for (const r of m.reactions) {
            const agg = byEmoji.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
            agg.count += 1;
            if (r.userId === myId) agg.mine = true;
            byEmoji.set(r.emoji, agg);
          }

          return {
            id: m.id,
            text,
            time: formatTime(m.createdAt),
            outgoing: m.senderId === myId,
            read: m.readAt != null,
            edited: m.editedAt != null,
            deleted,
            reactions: [...byEmoji.values()],
            reply,
          };
        }),
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

  // Initial load + real-time updates via Socket.IO (no polling).
  useEffect(() => {
    let active = true;
    loadMessages().finally(() => {
      if (active) setLoading(false);
    });

    const refreshIfMine = (payload: { conversationId?: string }) => {
      if (payload?.conversationId === id) loadMessages();
    };
    const unsubNew = onSocket('message:new', refreshIfMine);
    const unsubRead = onSocket('messages:read', refreshIfMine);
    const unsubUpdated = onSocket('message:updated', refreshIfMine);
    const unsubConnect = onSocket('connect', () => loadMessages());
    const unsubTyping = onSocket('typing', (p: { conversationId?: string; typing?: boolean }) => {
      if (p?.conversationId === id) setOtherTyping(!!p.typing);
    });

    return () => {
      active = false;
      unsubNew();
      unsubRead();
      unsubUpdated();
      unsubConnect();
      unsubTyping();
    };
  }, [loadMessages, id]);

  // Hide the typing indicator if a "stop" event is missed.
  useEffect(() => {
    if (!otherTyping) return;
    const t = setTimeout(() => setOtherTyping(false), 5000);
    return () => clearTimeout(t);
  }, [otherTyping]);

  const emitTyping = useCallback(
    (typing: boolean) => emitSocket('typing', { conversationId: id, typing }),
    [id],
  );

  const onChangeDraft = (text: string) => {
    setDraft(text);
    if (editing) return; // editing isn't "typing a new message"
    const now = Date.now();
    if (text.length > 0) {
      if (now - lastTypingEmit.current > 2000) {
        lastTypingEmit.current = now;
        emitTyping(true);
      }
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        emitTyping(false);
        lastTypingEmit.current = 0;
      }, 2500);
    } else if (lastTypingEmit.current) {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      emitTyping(false);
      lastTypingEmit.current = 0;
    }
  };

  const stopTyping = () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (lastTypingEmit.current) {
      emitTyping(false);
      lastTypingEmit.current = 0;
    }
  };

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
      if (editing) {
        await conversationsApi.edit(id, editing.id, ciphertext, nonce);
        setEditing(null);
      } else {
        await conversationsApi.send(id, ciphertext, nonce, replyingTo?.id);
        setReplyingTo(null);
      }
      setDraft('');
      stopTyping();
      await loadMessages();
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!id) return;
    try {
      await conversationsApi.react(id, messageId, emoji);
      await loadMessages();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to react');
    }
  };

  const beginReply = (m: DisplayMessage) => {
    setEditing(null);
    setReplyingTo(m);
    setMenuTarget(null);
  };

  const beginEdit = (m: DisplayMessage) => {
    setReplyingTo(null);
    setEditing(m);
    setDraft(m.text);
    setMenuTarget(null);
  };

  const confirmDelete = (m: DisplayMessage) => {
    setMenuTarget(null);
    Alert.alert('Delete message', 'Unsend this message for everyone?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          try {
            await conversationsApi.remove(id, m.id);
            if (editing?.id === m.id) {
              setEditing(null);
              setDraft('');
            }
            await loadMessages();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete');
          }
        },
      },
    ]);
  };

  const visibleMessages = query.trim()
    ? messages.filter((m) => !m.deleted && m.text.toLowerCase().includes(query.trim().toLowerCase()))
    : messages;

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="h-16 flex-row items-center gap-md border-b border-white/5 bg-surface-container/70 px-container-padding">
        <Pressable onPress={() => router.back()} className="-ml-2 h-10 w-10 items-center justify-center active:scale-95">
          <MaterialIcons name="arrow-back-ios-new" size={20} color={Palette.primary} />
        </Pressable>
        {searchOpen ? (
          <TextInput
            autoFocus
            className="h-10 flex-1 rounded-full border border-white/5 bg-surface-container-lowest px-md font-inter text-[15px] text-on-surface"
            placeholder="Search this chat…"
            placeholderTextColor={Palette.outline}
            value={query}
            onChangeText={setQuery}
          />
        ) : (
          <>
            <Avatar uri={`https://i.pravatar.cc/150?u=${contact?.id ?? id}`} size={40} showStatus={false} />
            <View className="min-w-0 flex-1">
              <Text className="font-inter-semibold text-[18px] text-on-surface" numberOfLines={1}>
                {contact?.name ?? 'Chat'}
              </Text>
              <Text className="font-inter-semibold text-[12px] text-tertiary">
                {otherTyping ? 'typing…' : 'End-to-end encrypted'}
              </Text>
            </View>
          </>
        )}
        <Pressable
          onPress={() => {
            setSearchOpen((v) => !v);
            setQuery('');
          }}
          className="h-10 w-10 items-center justify-center active:scale-90"
        >
          <MaterialIcons name={searchOpen ? 'close' : 'search'} size={22} color={Palette.primary} />
        </Pressable>
        {!searchOpen && (
          <Pressable
            onPress={() => router.push(`/verify/${id}`)}
            className="h-10 w-10 items-center justify-center active:scale-90"
          >
            <MaterialIcons name="verified-user" size={22} color={Palette.tertiary} />
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView className="flex-1" behavior="padding">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={Palette.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={visibleMessages}
            keyExtractor={(item) => item.id}
            contentContainerClassName="px-container-padding pb-md pt-sm"
            onContentSizeChange={() => {
              if (!query.trim()) listRef.current?.scrollToEnd({ animated: false });
            }}
            ListEmptyComponent={
              <View className="mt-32 items-center">
                <Text className="font-inter text-[14px] text-on-surface-variant">
                  {query.trim()
                    ? 'No messages match your search.'
                    : "No messages yet. Say hello — it's end-to-end encrypted."}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Bubble
                message={item}
                onLongPress={() => !item.deleted && setMenuTarget(item)}
                onToggleReaction={(emoji) => toggleReaction(item.id, emoji)}
              />
            )}
          />
        )}

        {error && (
          <Text className="px-container-padding pb-xs text-center font-inter text-[12px] text-error">
            {error}
          </Text>
        )}

        {/* Reply / edit context bar */}
        {(replyingTo || editing) && (
          <View className="flex-row items-center gap-sm border-t border-white/5 bg-surface-container-low px-container-padding py-sm">
            <MaterialIcons
              name={editing ? 'edit' : 'reply'}
              size={18}
              color={Palette.primary}
            />
            <View className="min-w-0 flex-1">
              <Text className="font-inter-semibold text-[12px] text-primary">
                {editing ? 'Editing message' : `Replying to ${replyingTo?.outgoing ? 'yourself' : 'them'}`}
              </Text>
              <Text className="font-inter text-[13px] text-on-surface-variant" numberOfLines={1}>
                {(editing ?? replyingTo)?.text}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setReplyingTo(null);
                if (editing) {
                  setEditing(null);
                  setDraft('');
                }
              }}
              className="h-8 w-8 items-center justify-center active:scale-90"
            >
              <MaterialIcons name="close" size={18} color={Palette.outline} />
            </Pressable>
          </View>
        )}

        {/* Input bar */}
        <View className="flex-row items-center gap-md border-t border-white/5 bg-surface-container/70 px-container-padding py-md">
          <View className="h-12 flex-1 flex-row items-center rounded-full border border-white/5 bg-surface-container-lowest px-md">
            <TextInput
              className="flex-1 font-inter text-[16px] text-on-surface"
              placeholder={editing ? 'Edit your message…' : 'Type a message…'}
              placeholderTextColor={Palette.outline}
              value={draft}
              onChangeText={onChangeDraft}
              onSubmitEditing={send}
              onBlur={stopTyping}
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
              <MaterialIcons name={editing ? 'check' : 'send'} size={22} color="#ffffff" />
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Message action menu */}
      <Modal
        visible={menuTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuTarget(null)}
      >
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setMenuTarget(null)}>
          <Pressable className="rounded-t-3xl bg-surface-container px-container-padding pb-xl pt-md">
            {/* Quick reactions */}
            <View className="mb-md flex-row justify-around rounded-2xl bg-surface-container-low py-sm">
              {QUICK_EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => {
                    const t = menuTarget;
                    setMenuTarget(null);
                    if (t) toggleReaction(t.id, emoji);
                  }}
                  className="h-11 w-11 items-center justify-center rounded-full active:bg-white/10"
                >
                  <Text className="text-[24px]">{emoji}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => menuTarget && beginReply(menuTarget)}
              className="flex-row items-center gap-md rounded-xl px-md py-md active:bg-white/5"
            >
              <MaterialIcons name="reply" size={22} color={Palette.onSurface} />
              <Text className="font-inter text-[16px] text-on-surface">Reply</Text>
            </Pressable>

            {menuTarget?.outgoing && (
              <>
                <Pressable
                  onPress={() => menuTarget && beginEdit(menuTarget)}
                  className="flex-row items-center gap-md rounded-xl px-md py-md active:bg-white/5"
                >
                  <MaterialIcons name="edit" size={22} color={Palette.onSurface} />
                  <Text className="font-inter text-[16px] text-on-surface">Edit</Text>
                </Pressable>
                <Pressable
                  onPress={() => menuTarget && confirmDelete(menuTarget)}
                  className="flex-row items-center gap-md rounded-xl px-md py-md active:bg-white/5"
                >
                  <MaterialIcons name="delete-outline" size={22} color={Palette.error} />
                  <Text className="font-inter text-[16px] text-error">Delete</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
