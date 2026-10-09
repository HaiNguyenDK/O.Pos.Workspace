// src/components/sheets/approval-sheet.tsx — quản lý nhập PIN để duyệt (D12).
// Trả về approvalToken dùng 1 lần cho đúng thao tác (huỷ món đã làm, giảm giá tay, xác nhận VietQR thủ công).
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react-native';
import { Text, View } from '@/tw';
import { PinKeypad } from '@/components/ui/pin-keypad';
import { useRequestApproval } from '@/data/queries';
import { color } from '@/lib/theme';
import type { Approval, ApprovalAction } from '@/data/types';

export type ApprovalSheetHandle = {
  /** Mở sheet; gọi onApproved khi quản lý nhập PIN hợp lệ. */
  request: (action: ApprovalAction, title: string, onApproved: (a: Approval) => void) => void;
};

export const ApprovalSheet = forwardRef<ApprovalSheetHandle>(function ApprovalSheet(_props, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const approve = useRequestApproval();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<{ action: ApprovalAction; title: string; onApproved: (a: Approval) => void } | null>(null);
  const [title, setTitle] = useState('');

  useImperativeHandle(ref, () => ({
    request: (action, t, onApproved) => {
      pending.current = { action, title: t, onApproved };
      setTitle(t);
      setPin('');
      setError(null);
      sheet.current?.present();
    },
  }));

  useEffect(() => {
    if (pin.length !== 6 || approve.isPending || !pending.current) return;
    const req = pending.current;
    approve.mutate(
      { pin, action: req.action },
      {
        onSuccess: (a) => {
          sheet.current?.dismiss();
          req.onApproved(a);
        },
        onError: (e) => {
          setError((e as Error).message);
          setPin('');
        },
      }
    );
  }, [pin, approve]);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    []
  );

  return (
    <BottomSheetModal
      ref={sheet}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: color.text.muted }}
      backgroundStyle={{ backgroundColor: color.bg.surface }}
    >
      <BottomSheetView style={{ padding: 20, paddingBottom: 36, alignItems: 'center' }}>
        <View className="mb-2 flex-row items-center">
          <ShieldCheck size={20} color={color.brand.DEFAULT} />
          <Text className="ml-2 text-xl font-extrabold text-fg">Quản lý duyệt</Text>
        </View>
        <Text className="mb-6 text-center text-muted">{error ?? title}</Text>
        <PinKeypad value={pin} onChange={setPin} error={!!error} />
      </BottomSheetView>
    </BottomSheetModal>
  );
});
