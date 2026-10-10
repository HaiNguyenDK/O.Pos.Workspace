// src/lib/device.ts — id cố định của máy (header X-Device-Id, 16–64 ký tự theo BE pkg/middleware).
// Sinh 1 lần, lưu SecureStore; BE so với claim deviceIdHash trong token → lệch = DEVICE_MISMATCH.
import * as SecureStore from 'expo-secure-store';
import { setDeviceId } from '@/data/api/session';
import { newId } from '@/lib/id';

const DEVICE_KEY = 'pos.device.id';

export async function loadDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(DEVICE_KEY);
  if (!id) {
    id = newId();
    await SecureStore.setItemAsync(DEVICE_KEY, id);
  }
  setDeviceId(id);
  return id;
}
