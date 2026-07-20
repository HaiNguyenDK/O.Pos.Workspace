// src/components/ui/button.tsx — nút chính. brand=cam, cart=đỏ, ghost=viền.
import type { ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';
import { Pressable, Text } from '@/tw';
import { cn } from '@/lib/cn';

type Variant = 'brand' | 'cart' | 'ghost' | 'surface';

const base = 'flex-row items-center justify-center rounded-2xl px-5 py-4';
const variantBg: Record<Variant, string> = {
  brand: 'bg-brand active:opacity-90',
  cart: 'bg-cart active:opacity-90',
  ghost: 'bg-transparent border border-line active:bg-elevated',
  surface: 'bg-elevated active:opacity-80',
};
const variantText: Record<Variant, string> = {
  brand: 'text-white',
  cart: 'text-white',
  ghost: 'text-fg',
  surface: 'text-fg',
};

export function Button({
  label,
  onPress,
  variant = 'brand',
  disabled,
  loading,
  className,
  leftIcon,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  leftIcon?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={cn(base, variantBg[variant], (disabled || loading) && 'opacity-50', className)}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          {leftIcon}
          <Text className={cn('text-base font-bold', variantText[variant], leftIcon && 'ml-2')}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
