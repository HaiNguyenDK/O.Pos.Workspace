// src/components/ui/card.tsx — bề mặt nổi trên nền app, viền mờ.
import type { ReactNode } from 'react';
import { View } from '@/tw';
import { cn } from '@/lib/cn';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View className={cn('rounded-2xl border border-line bg-surface p-4', className)}>
      {children}
    </View>
  );
}
