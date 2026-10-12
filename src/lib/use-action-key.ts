// src/lib/use-action-key.ts — idempotencyKey cho MỘT thao tác của người dùng (pos-plan Mục 3.2).
// Bấm lại sau lỗi mạng → dùng lại key cũ (server không tạo trùng). Thành công / lỗi nghiệp vụ → key mới.
import { useCallback, useRef } from 'react';
import { isPosApiError } from '@/data/types';
import { newId } from '@/lib/id';

export function useActionKey() {
  const ref = useRef<string | null>(null);

  const key = useCallback(() => {
    if (!ref.current) ref.current = newId();
    return ref.current;
  }, []);

  const reset = useCallback(() => {
    ref.current = null;
  }, []);

  /** Gọi trong onError: chỉ giữ key khi lỗi mạng (có thể thử lại cùng thao tác). */
  const settle = useCallback((e?: unknown) => {
    if (e === undefined || isPosApiError(e)) ref.current = null;
  }, []);

  return { key, reset, settle };
}
