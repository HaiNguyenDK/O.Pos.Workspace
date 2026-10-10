// src/data/api/session.ts — phiên đăng nhập hiện tại cho tầng API.
// auth-store ghi vào đây; impl API đọc ra (mock: biết ai đang thao tác; real: gắn Authorization header).
import type { Staff } from '@/data/types';

export type ApiSession = { accessToken: string; refreshToken: string; expiresAt: string; staff: Staff };

let current: ApiSession | null = null;

export const apiSession = {
  get: () => current,
  set: (s: ApiSession | null) => {
    current = s;
  },
};

/** Id cố định của máy — BE so với claim deviceIdHash trong token. Gán khi khởi động (lib/device). */
let deviceId = '';
export const setDeviceId = (id: string) => {
  deviceId = id;
};
export const getDeviceId = () => deviceId;
