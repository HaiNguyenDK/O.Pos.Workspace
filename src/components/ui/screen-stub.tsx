// src/components/ui/screen-stub.tsx — placeholder màn chưa làm (Sprint 1+). Có back + tiêu đề.
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, Text, View } from '@/tw';
import { color } from '@/lib/theme';

export function ScreenStub({ title, sprint }: { title: string; sprint: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }}>
      <View className="flex-row items-center px-4 py-3">
        {router.canGoBack() && (
          <Pressable onPress={() => router.back()} className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70">
            <ChevronLeft size={22} color={color.text.primary} />
          </Pressable>
        )}
        <Text className="text-xl font-extrabold text-fg">{title}</Text>
      </View>
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-center text-base text-muted">
          {t('stub.message', { title, sprint })}
        </Text>
        <Text className="mt-2 text-center text-xs text-muted">
          {t('stub.routeNote')}
        </Text>
      </View>
    </SafeAreaView>
  );
}
