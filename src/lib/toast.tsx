// src/lib/toast.tsx — toast dùng chung (thay sonner của web). Style theo dark+cam.
import { CheckCircle2, Info, XCircle } from 'lucide-react-native';
import Toast, { type ToastConfig } from 'react-native-toast-message';
import { Text, View } from '@/tw';
import { color } from '@/lib/theme';

function Base({
  title,
  message,
  accent,
  icon,
}: {
  title?: string;
  message?: string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <View
      className="mx-4 flex-row items-center rounded-2xl border border-line bg-elevated px-4 py-3"
      style={{ borderLeftColor: accent, borderLeftWidth: 3 }}
    >
      {icon}
      <View className="ml-3 flex-1">
        {!!title && <Text className="font-bold text-fg">{title}</Text>}
        {!!message && <Text className="text-sm text-muted">{message}</Text>}
      </View>
    </View>
  );
}

export const toastConfig: ToastConfig = {
  success: ({ text1, text2 }) => (
    <Base title={text1} message={text2} accent={color.status.available} icon={<CheckCircle2 size={22} color={color.status.available} />} />
  ),
  error: ({ text1, text2 }) => (
    <Base title={text1} message={text2} accent={color.status.cancelled} icon={<XCircle size={22} color={color.status.cancelled} />} />
  ),
  info: ({ text1, text2 }) => (
    <Base title={text1} message={text2} accent={color.brand.DEFAULT} icon={<Info size={22} color={color.brand.DEFAULT} />} />
  ),
};

export const toast = {
  success: (text1: string, text2?: string) => Toast.show({ type: 'success', text1, text2 }),
  error: (text1: string, text2?: string) => Toast.show({ type: 'error', text1, text2 }),
  info: (text1: string, text2?: string) => Toast.show({ type: 'info', text1, text2 }),
  /** Toast có hành động: chạm vào toast → onPress (vd "Máy chưa mở ca" → mở màn ca). */
  action: (type: 'success' | 'error' | 'info', text1: string, text2: string | undefined, onPress: () => void) =>
    Toast.show({
      type,
      text1,
      text2,
      visibilityTime: 6000,
      onPress: () => {
        Toast.hide();
        onPress();
      },
    }),
};
