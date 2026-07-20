// src/lib/connectivity.ts — trạng thái mạng qua NetInfo + đồng bộ TanStack onlineManager.
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/** Gọi 1 lần khi app khởi động: để TanStack Query biết online/offline. */
export function setupOnlineManager() {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false);
    })
  );
}

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe((v) => setOnline(v)), []);
  return online;
}
