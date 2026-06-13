import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ApiError, requestsApi, usersApi, type PublicUser, type Relationship } from '@/lib/api';
import { Palette } from '@/constants/palette';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function NewChatScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ user: PublicUser; relationship: Relationship } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value) || searching) return;
    setSearching(true);
    setError(null);
    setResult(null);
    try {
      setResult(await usersApi.search(value));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async () => {
    if (!result || busy) return;
    setBusy(true);
    setError(null);
    try {
      await requestsApi.send(result.user.id);
      setResult({ ...result, relationship: { status: 'request_sent', requestId: '' } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send request');
    } finally {
      setBusy(false);
    }
  };

  const acceptRequest = async () => {
    if (!result || result.relationship.status !== 'request_received' || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { conversation } = await requestsApi.accept(result.relationship.requestId);
      router.replace(`/chat/${conversation.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not accept');
    } finally {
      setBusy(false);
    }
  };

  const renderAction = () => {
    if (!result) return null;
    const rel = result.relationship;
    switch (rel.status) {
      case 'self':
        return <Text className="font-inter text-[14px] text-outline">This is you.</Text>;
      case 'connected':
        return (
          <Pressable
            onPress={() => router.replace(`/chat/${rel.conversationId}`)}
            className="rounded-lg bg-primary px-lg py-sm active:scale-95"
          >
            <Text className="font-inter-semibold text-[14px] text-on-primary">Open chat</Text>
          </Pressable>
        );
      case 'request_sent':
        return <Text className="font-inter-semibold text-[14px] text-tertiary">Request sent</Text>;
      case 'request_received':
        return (
          <Pressable
            onPress={acceptRequest}
            disabled={busy}
            className="rounded-lg bg-tertiary px-lg py-sm active:scale-95"
          >
            <Text className="font-inter-semibold text-[14px] text-on-tertiary">Accept</Text>
          </Pressable>
        );
      default:
        return (
          <Pressable
            onPress={sendRequest}
            disabled={busy}
            className="rounded-lg bg-primary px-lg py-sm active:scale-95"
          >
            <Text className="font-inter-semibold text-[14px] text-on-primary">
              {busy ? 'Sending…' : 'Send request'}
            </Text>
          </Pressable>
        );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="h-16 flex-row items-center gap-md border-b border-white/5 px-container-padding">
        <Pressable onPress={() => router.back()} className="-ml-2 h-10 w-10 items-center justify-center active:scale-95">
          <MaterialIcons name="arrow-back-ios-new" size={20} color={Palette.primary} />
        </Pressable>
        <Text className="font-inter-semibold text-[18px] text-on-surface">New chat</Text>
      </View>

      <View className="px-container-padding pt-lg">
        <Text className="ml-xs font-inter-medium text-[14px] text-on-surface">Find someone by email</Text>
        <View className="mt-sm flex-row items-center gap-sm">
          <View className="h-12 flex-1 flex-row items-center rounded-lg border border-white/10 bg-surface-container-lowest px-md">
            <MaterialIcons name="mail-outline" size={20} color={Palette.outline} />
            <TextInput
              className="ml-sm flex-1 font-inter text-[16px] text-on-surface"
              placeholder="name@example.com"
              placeholderTextColor={`${Palette.outline}99`}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={search}
              returnKeyType="search"
            />
          </View>
          <Pressable onPress={search} className="h-12 w-12 items-center justify-center rounded-lg bg-primary active:scale-95">
            {searching ? (
              <ActivityIndicator color={Palette.onPrimary} />
            ) : (
              <MaterialIcons name="search" size={24} color={Palette.onPrimary} />
            )}
          </Pressable>
        </View>

        {error && <Text className="mt-md font-inter text-[14px] text-error">{error}</Text>}

        {result && (
          <View className="mt-lg flex-row items-center rounded-xl border border-white/10 bg-white/5 p-md">
            <Avatar uri={`https://i.pravatar.cc/150?u=${result.user.id}`} size={48} showStatus={false} />
            <View className="ml-md flex-1">
              <Text className="font-inter-bold text-[16px] text-on-surface">{result.user.name}</Text>
              <Text className="font-inter text-[13px] text-on-surface-variant">{result.user.email}</Text>
            </View>
            {renderAction()}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
