import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { CONVERSATIONS, type Conversation, AVATARS } from '@/constants/mock-data';
import { Palette } from '@/constants/palette';

const FILTERS = ['All', 'Unread', 'Groups', 'Work'] as const;

function ChatRow({ chat, onPress }: { chat: Conversation; onPress: () => void }) {
  const hasUnread = chat.unread > 0;
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-xl p-md active:bg-primary/5"
    >
      <Avatar uri={chat.avatar} size={56} online={chat.online} />
      <View className="ml-md min-w-0 flex-1">
        <View className="mb-1 flex-row items-baseline justify-between">
          <Text className="flex-1 font-inter-bold text-[16px] text-on-surface" numberOfLines={1}>
            {chat.name}
          </Text>
          <Text
            className={`ml-sm font-inter-semibold text-[12px] ${hasUnread ? 'text-primary' : 'text-outline'}`}
          >
            {chat.time}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text
            className={`flex-1 pr-md font-inter text-[14px] ${hasUnread ? 'text-on-surface-variant' : 'text-outline'}`}
            numberOfLines={1}
          >
            {chat.lastMessage}
          </Text>
          {hasUnread && (
            <View
              className="min-w-[20px] items-center rounded-full bg-primary px-1.5 py-0.5"
              style={{
                shadowColor: Palette.primary,
                shadowOpacity: 0.3,
                shadowRadius: 10,
                elevation: 4,
              }}
            >
              <Text className="font-inter-semibold text-[12px] text-on-primary-container">
                {chat.unread}
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
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');

  const chats =
    filter === 'Unread'
      ? CONVERSATIONS.filter((c) => c.unread > 0)
      : filter === 'Groups'
        ? CONVERSATIONS.filter((c) => c.isGroup)
        : filter === 'Work'
          ? CONVERSATIONS.filter((c) => c.id === 'jordan' || c.id === 'group')
          : CONVERSATIONS;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Top app bar */}
      <View className="h-16 flex-row items-center justify-between border-b border-white/5 px-container-padding">
        <View className="flex-row items-center gap-md">
          <Avatar uri={AVATARS.me} size={40} showStatus={false} />
          <Text className="font-inter-bold text-[20px] text-primary">Messages</Text>
        </View>
        <Pressable className="h-10 w-10 items-center justify-center rounded-full active:opacity-80">
          <MaterialIcons name="search" size={24} color={Palette.primary} />
        </Pressable>
      </View>

      {/* Filter chips */}
      <View className="pt-md">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-sm px-container-padding pb-xs"
        >
          {FILTERS.map((f) => {
            const active = f === filter;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                className={`rounded-full px-md py-xs ${
                  active ? 'bg-primary' : 'border border-white/5 bg-surface-container-high'
                }`}
              >
                <Text
                  className={`font-inter-semibold text-[12px] ${
                    active ? 'text-on-primary' : 'text-on-surface-variant'
                  }`}
                >
                  {f}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Chat list */}
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-xs pb-28"
        renderItem={({ item }) => (
          <ChatRow chat={item} onPress={() => router.push(`/chat/${item.id}`)} />
        )}
      />

      {/* Floating action button */}
      <Pressable className="absolute bottom-6 right-container-padding active:scale-90">
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
