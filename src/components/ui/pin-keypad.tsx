// src/components/ui/pin-keypad.tsx — bàn phím PIN 6 số + haptics khi sai (thay shake). Màn 1.
import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { Delete } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { color } from '@/lib/theme';
import { useSettingsStore } from '@/store/settings-store';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

export function PinKeypad({
  value,
  onChange,
  length = 6,
  error,
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  error?: boolean;
}) {
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);

  const press = useCallback(
    (k: string) => {
      if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (k === 'del') return onChange(value.slice(0, -1));
      if (value.length >= length) return;
      onChange(value + k);
    },
    [value, length, onChange, hapticsEnabled]
  );

  return (
    <View className="items-center">
      {/* Dots */}
      <View className="mb-8 flex-row gap-3">
        {Array.from({ length }).map((_, i) => (
          <View
            key={i}
            className="h-3.5 w-3.5 rounded-full"
            style={{
              backgroundColor: error
                ? color.status.cancelled
                : i < value.length
                  ? color.brand.DEFAULT
                  : color.bg.elevated,
            }}
          />
        ))}
      </View>
      {/* Keys */}
      <View className="w-72 flex-row flex-wrap">
        {KEYS.map((k, i) =>
          k === '' ? (
            <View key={i} className="h-20 w-1/3" />
          ) : (
            <Pressable
              key={i}
              onPress={() => press(k)}
              className="h-20 w-1/3 items-center justify-center active:opacity-60"
            >
              {k === 'del' ? (
                <Delete size={26} color={color.text.primary} />
              ) : (
                <Text className="text-3xl font-semibold text-fg">{k}</Text>
              )}
            </Pressable>
          )
        )}
      </View>
    </View>
  );
}
