// src/lib/haptics.ts — rung phản hồi, tôn trọng setting hapticsEnabled (Mục 5).
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store/settings-store';

const on = () => useSettingsStore.getState().hapticsEnabled;

export const haptics = {
  light: () => on() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => on() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => on() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => on() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => on() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};
