import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { conversationsApi, type PublicUser } from '@/lib/api';
import { getPublicKey, safetyNumber } from '@/lib/crypto';
import { isVerified, setVerified } from '@/lib/verification';
import { Palette } from '@/constants/palette';

export default function VerifyScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [contact, setContact] = useState<PublicUser | null>(null);
  const [number, setNumber] = useState<string | null>(null);
  const [verified, setVerifiedState] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [{ conversations }, myKey, v] = await Promise.all([
          conversationsApi.list(),
          getPublicKey(),
          isVerified(id ?? ''),
        ]);
        const convo = conversations.find((c) => c.id === id);
        if (!active) return;
        setVerifiedState(v);
        if (convo) {
          setContact(convo.contact);
          if (convo.contact.publicKey) {
            setNumber(safetyNumber(myKey, convo.contact.publicKey));
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const toggleVerified = async () => {
    const next = !verified;
    setVerifiedState(next);
    await setVerified(id ?? '', next);
  };

  const groups = number?.split(' ') ?? [];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="h-16 flex-row items-center gap-md border-b border-white/5 px-container-padding">
        <Pressable onPress={() => router.back()} className="-ml-2 h-10 w-10 items-center justify-center active:scale-95">
          <MaterialIcons name="arrow-back-ios-new" size={20} color={Palette.primary} />
        </Pressable>
        <Text className="font-inter-semibold text-[18px] text-on-surface">Verify Encryption</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Palette.primary} />
        </View>
      ) : (
        <ScrollView contentContainerClassName="px-container-padding pb-xl pt-lg">
          <View className="items-center">
            <Avatar uri={`https://i.pravatar.cc/150?u=${contact?.id}`} size={72} showStatus={false} />
            <Text className="mt-md font-inter-bold text-[20px] text-on-surface">{contact?.name}</Text>
            <View className="mt-xs flex-row items-center gap-xs">
              <MaterialIcons name="lock" size={14} color={Palette.tertiary} />
              <Text className="font-inter-semibold text-[12px] text-tertiary">End-to-end encrypted</Text>
            </View>
          </View>

          <View className="mt-xl rounded-xl border border-white/10 bg-white/5 p-lg">
            <Text className="mb-md text-center font-inter-semibold text-[12px] uppercase tracking-widest text-outline">
              Safety Number
            </Text>
            {number ? (
              <View className="flex-row flex-wrap justify-center gap-x-lg gap-y-sm">
                {groups.map((g, i) => (
                  <Text
                    key={i}
                    className="font-mono text-[18px] tracking-widest text-on-surface"
                    style={{ width: '40%', textAlign: 'center' }}
                  >
                    {g}
                  </Text>
                ))}
              </View>
            ) : (
              <Text className="text-center font-inter text-[14px] text-outline">
                This contact hasn&apos;t set up encryption yet.
              </Text>
            )}
          </View>

          <Text className="mt-lg text-center font-inter text-[14px] leading-6 text-on-surface-variant">
            Compare this number with {contact?.name ?? 'your contact'} in person or over another
            trusted channel. If the numbers match on both devices, no one is intercepting your
            messages — not even the server.
          </Text>

          {number &&
            (verified ? (
              <>
                <View className="mt-xl flex-row items-center justify-center gap-sm rounded-xl border border-tertiary/30 bg-tertiary/10 py-md">
                  <MaterialIcons name="verified-user" size={20} color={Palette.tertiary} />
                  <Text className="font-inter-semibold text-[16px] text-tertiary">Verified</Text>
                </View>
                <Pressable onPress={toggleVerified} className="mt-sm py-sm active:opacity-80">
                  <Text className="text-center font-inter-medium text-[13px] text-outline">
                    Clear verification
                  </Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={toggleVerified}
                className="mt-xl rounded-xl bg-primary py-md active:scale-[0.98]"
              >
                <Text className="text-center font-inter-semibold text-[16px] text-on-primary">
                  Mark as Verified
                </Text>
              </Pressable>
            ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
