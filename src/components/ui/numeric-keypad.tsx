// src/components/ui/numeric-keypad.tsx — nhập số tiền (màn payment/cash). Port logic Mục 7 #9.
import { Delete } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { color } from '@/lib/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'] as const;

export function NumericKeypad({
  value,
  onChange,
  maxLength = 12,
}: {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
}) {
  const press = (k: string) => {
    if (k === 'del') return onChange(value.slice(0, -1));
    const next = (value === '0' ? '' : value) + k;
    if (next.length > maxLength) return;
    onChange(next);
  };

  return (
    <View className="flex-row flex-wrap">
      {KEYS.map((k, i) => (
        <Pressable
          key={i}
          onPress={() => press(k)}
          className="h-16 w-1/3 items-center justify-center rounded-xl active:bg-elevated"
        >
          {k === 'del' ? (
            <Delete size={24} color={color.text.primary} />
          ) : (
            <Text className="text-2xl font-semibold text-fg">{k}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}
