// src/components/ui/error-state.tsx — trạng thái lỗi dùng chung + nút thử lại.
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react-native';
import { Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { color } from '@/lib/theme';

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <TriangleAlert size={40} color={color.status.cancelled} />
      <Text className="mt-3 text-center text-fg">{message ?? t('common.error')}</Text>
      {onRetry && <Button className="mt-5" variant="ghost" label={t('common.retry')} onPress={onRetry} />}
    </View>
  );
}
