// src/tw — CSS-enabled RN primitives for NativeWind v5 + react-native-css.
// Import View/Text/Pressable/TextInput FROM HERE (not react-native) để `className` hoạt động.
// Component truyền vào useCssElement được cast ComponentType<any> để chặn TS2590
// (Pressable có style/children dạng function → union quá phức tạp). Props param VẪN
// giữ type đầy đủ cho caller. ScrollView/FlatList dùng RN gốc + `style`.
import React from 'react';
import {
  Pressable as RNPressable,
  Text as RNText,
  TextInput as RNTextInput,
  View as RNView,
} from 'react-native';
import { useCssElement } from 'react-native-css';

type WithClass<P> = P & { className?: string };
const css = (Component: React.ComponentType<any>) => (props: object) =>
  useCssElement(Component, props, { className: 'style' });

export type ViewProps = WithClass<React.ComponentProps<typeof RNView>>;
export const View = (props: ViewProps) => css(RNView)(props);
View.displayName = 'CSS(View)';

export const Text = (props: WithClass<React.ComponentProps<typeof RNText>>) => css(RNText)(props);
Text.displayName = 'CSS(Text)';

export const Pressable = (props: WithClass<React.ComponentProps<typeof RNPressable>>) =>
  css(RNPressable)(props);
Pressable.displayName = 'CSS(Pressable)';

export const TextInput = (props: WithClass<React.ComponentProps<typeof RNTextInput>>) =>
  css(RNTextInput)(props);
TextInput.displayName = 'CSS(TextInput)';
