// Màn 10 — VietQR: hiển thị QR, đếm ngược 300s, poll trạng thái (mock auto-paid).
// Khi có backend: thay setTimeout bằng poll PosApi (getBill/paymentStatus).
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { usePay } from '@/data/queries';
import { calcTotal } from '@/domain/pricing';
import { formatMoney } from '@/lib/format';
import { color } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { useBillStore } from '@/store/bill-store';
import { useOrderStore } from '@/store/order-store';

const COUNTDOWN = 300; // 5 phút

export default function PaymentQr() {
  const router = useRouter();
  const active = useOrderStore((s) => s.active);
  const items = useOrderStore((s) => s.sentLines);
  const bill = useBillStore();
  const pay = usePay();

  const [left, setLeft] = useState(COUNTDOWN);
  const paidRef = useRef(false);

  const total =
    active && items.length
      ? calcTotal(items, {
          voucher: bill.voucher ?? undefined,
          tip: bill.tip,
          discount: bill.discount,
          service: bill.service,
        }).total
      : 0;

  // Đếm ngược
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  const onPaid = () => {
    if (paidRef.current || !active) return;
    paidRef.current = true;
    pay.mutate(
      { billId: `b${active.orderId}`, method: 'qr' },
      {
        onSuccess: () => router.replace('/(app)/payment/success'),
        onError: (e) => {
          paidRef.current = false;
          toast.error('Lỗi thanh toán', (e as Error).message);
        },
      }
    );
  };

  // Poll mock: tự động "nhận tiền" sau 7s (giả lập webhook cổng thanh toán).
  useEffect(() => {
    const id = setTimeout(onPaid, 7000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!active || items.length === 0) return <Redirect href="/(app)/cart" />;

  const expired = left <= 0;
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  // Payload demo (không phải EMVCo VietQR thật) — đủ để render QR.
  const payload = `VIETQR|ORDER:${active.orderId}|AMOUNT:${total}|REF:${active.tableName ?? 'TA'}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }} edges={['top']}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70">
          <ChevronLeft size={22} color={color.text.primary} />
        </Pressable>
        <Text className="text-xl font-extrabold text-fg">VietQR</Text>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        <Text className="mb-1 text-muted">Quét mã để thanh toán</Text>
        <Text className="mb-6 text-3xl font-extrabold text-brand">{formatMoney(total)}</Text>

        <View className="rounded-3xl bg-white p-5" style={{ opacity: expired ? 0.3 : 1 }}>
          <QRCode value={payload} size={220} />
        </View>

        <Text className={`mt-6 text-lg font-bold ${expired ? 'text-cancelled' : 'text-fg'}`}>
          {expired ? 'Mã đã hết hạn' : `Còn hiệu lực ${mm}:${ss}`}
        </Text>
        {pay.isPending && <Text className="mt-2 text-brand">Đang xác nhận thanh toán…</Text>}
      </View>

      <View className="gap-3 px-4 pb-4">
        {expired ? (
          <Button label="Tạo mã mới" onPress={() => { setLeft(COUNTDOWN); paidRef.current = false; }} />
        ) : (
          <Button label="Khách đã chuyển (xác nhận)" onPress={onPaid} loading={pay.isPending} />
        )}
      </View>
    </SafeAreaView>
  );
}
