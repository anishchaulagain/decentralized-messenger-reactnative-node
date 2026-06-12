import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import {
  CONVERSATIONS,
  DIRECT_MESSAGES,
  GROUP_MESSAGES,
  type Message,
} from '@/constants/mock-data';
import { Palette } from '@/constants/palette';

function MessageBubble({ message, isGroup }: { message: Message; isGroup: boolean }) {
  if (message.outgoing) {
    return (
      <View className="mb-md max-w-[85%] items-end self-end">
        <LinearGradient
          colors={[Palette.primaryContainer, Palette.secondaryContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 16,
            borderTopRightRadius: 4,
            paddingHorizontal: 16,
            paddingVertical: 10,
          }}
        >
          {message.text && (
            <Text className="font-inter text-[16px] leading-6 text-white">{message.text}</Text>
          )}
        </LinearGradient>
        <View className="mt-xs flex-row items-center gap-xs">
          <Text className="font-inter-semibold text-[12px] text-outline opacity-60">
            {message.time}
          </Text>
          {message.read && <MaterialIcons name="done-all" size={14} color={Palette.primary} />}
        </View>
      </View>
    );
  }

  return (
    <View className="mb-md max-w-[85%] self-start">
      {isGroup && message.senderName && (
        <View className="mb-xs ml-1 flex-row items-center gap-xs">
          <Text
            className="font-inter-semibold text-[12px]"
            style={{ color: message.senderColor ?? Palette.tertiary }}
          >
            {message.senderName}
          </Text>
          <Text className="font-mono text-[10px] uppercase text-outline">{message.time}</Text>
        </View>
      )}
      <View className="flex-row items-end gap-sm">
        {isGroup && message.senderAvatar && (
          <Image
            source={{ uri: message.senderAvatar }}
            style={{ width: 32, height: 32, borderRadius: 16 }}
            contentFit="cover"
          />
        )}
        <View
          className={`rounded-2xl border border-white/5 bg-surface-container-high ${
            message.image ? 'p-1.5' : 'px-md py-sm'
          } ${isGroup ? 'rounded-bl' : 'rounded-tl'}`}
        >
          {message.image && (
            <Image
              source={{ uri: message.image }}
              style={{ width: 240, height: 135, borderRadius: 12 }}
              contentFit="cover"
            />
          )}
          {message.text && (
            <Text
              className={`font-inter text-[16px] leading-6 text-on-surface ${message.image ? 'mt-sm px-xs pb-xs' : ''}`}
            >
              {message.text}
            </Text>
          )}
        </View>
      </View>
      {!isGroup && (
        <Text className="ml-1 mt-xs font-inter-semibold text-[12px] text-outline opacity-60">
          {message.time}
        </Text>
      )}
    </View>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [draft, setDraft] = useState('');

  const chat = CONVERSATIONS.find((c) => c.id === id);
  const isGroup = chat?.isGroup ?? false;
  const baseMessages = isGroup ? GROUP_MESSAGES : (DIRECT_MESSAGES[id ?? ''] ?? []);
  const [messages, setMessages] = useState<Message[]>(baseMessages);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        text,
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        outgoing: true,
        read: false,
      },
    ]);
    setDraft('');
  };

  if (!chat) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="font-inter text-[16px] text-on-surface-variant">
          Conversation not found.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="h-16 flex-row items-center gap-md border-b border-white/5 bg-surface-container/70 px-container-padding">
        <Pressable
          onPress={() => router.back()}
          className="-ml-2 h-10 w-10 items-center justify-center active:scale-95"
        >
          <MaterialIcons name="arrow-back-ios-new" size={20} color={Palette.primary} />
        </Pressable>
        <Avatar uri={chat.avatar} size={40} online={chat.online} />
        <View className="min-w-0 flex-1">
          <Text className="font-inter-semibold text-[18px] text-on-surface" numberOfLines={1}>
            {chat.name}
          </Text>
          <Text
            className={`font-inter-semibold text-[12px] ${isGroup ? 'text-on-surface-variant' : 'text-tertiary'}`}
          >
            {isGroup ? `${chat.members} members` : chat.online ? 'Online' : 'Offline'}
          </Text>
        </View>
        <View className="flex-row items-center gap-sm">
          <Pressable className="h-10 w-10 items-center justify-center active:scale-90">
            <MaterialIcons name="videocam" size={24} color={Palette.onSurfaceVariant} />
          </Pressable>
          <Pressable className="h-10 w-10 items-center justify-center active:scale-90">
            <MaterialIcons name="call" size={22} color={Palette.onSurfaceVariant} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-container-padding pb-md pt-sm"
          ListHeaderComponent={
            <View className="items-center py-lg">
              <View className="rounded-full bg-surface-container-high px-3 py-1">
                <Text className="font-mono text-[10px] uppercase tracking-widest text-outline">
                  Today
                </Text>
              </View>
            </View>
          }
          renderItem={({ item }) => <MessageBubble message={item} isGroup={isGroup} />}
        />

        {/* Input bar */}
        <View className="flex-row items-center gap-md border-t border-white/5 bg-surface-container/70 px-container-padding py-md">
          <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-surface-container-high active:scale-90">
            <MaterialIcons name="add" size={24} color={Palette.onSurfaceVariant} />
          </Pressable>
          <View className="h-12 flex-1 flex-row items-center rounded-full border border-white/5 bg-surface-container-lowest px-md">
            <MaterialIcons name="sentiment-satisfied" size={22} color={Palette.outline} />
            <TextInput
              className="ml-sm flex-1 font-inter text-[16px] text-on-surface"
              placeholder="Type a message..."
              placeholderTextColor={Palette.outline}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={send}
              returnKeyType="send"
            />
            <MaterialIcons name="photo-camera" size={22} color={Palette.outline} />
          </View>
          <Pressable onPress={send} className="active:scale-90">
            <LinearGradient
              colors={[Palette.primaryContainer, Palette.secondaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialIcons name={draft.trim() ? 'send' : 'mic'} size={22} color="#ffffff" />
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
