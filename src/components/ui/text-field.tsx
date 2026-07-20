// src/components/ui/text-field.tsx — ô nhập chuẩn: padding ngang rộng (18), style inline
// (không phụ thuộc className) để chữ không sát border. Dùng cho form toàn màn.
import { forwardRef } from 'react';
import { TextInput as RNTextInput, type TextInputProps } from 'react-native';
import { color } from '@/lib/theme';

export const TextField = forwardRef<RNTextInput, TextInputProps>(function TextField(
  { style, multiline, ...props },
  ref
) {
  return (
    <RNTextInput
      ref={ref}
      placeholderTextColor={color.text.muted}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      style={[
        {
          borderRadius: 16,
          borderWidth: 1,
          borderColor: color.line,
          backgroundColor: color.bg.surface,
          color: color.text.primary,
          paddingHorizontal: 18,
          paddingVertical: 14,
          fontSize: 16,
          minHeight: multiline ? 96 : 52,
        },
        style,
      ]}
      {...props}
    />
  );
});
