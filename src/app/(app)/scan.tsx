// Quét QR bàn (expo-camera). QR chứa tableId ("t5") hoặc deep link ".../table/t5".
// Quét đúng bàn → mở/tiếp tục đơn tại bàn đó.
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { useTables } from '@/data/queries';
import { color } from '@/lib/theme';
import { toast } from '@/lib/toast';

/** Rút tableId từ nội dung QR: "t5" | "posmobile://table/t5" | ".../table/t5". */
function parseTableId(raw: string): string | null {
  const m = raw.match(/table\/([\w-]+)/i);
  if (m) return m[1];
  if (/^[\w-]+$/.test(raw.trim())) return raw.trim();
  return null;
}

export default function Scan() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const tables = useTables();
  const [locked, setLocked] = useState(false);
  const lastScan = useRef(0);

  const onScan = (data: string) => {
    const now = Date.now();
    if (locked || now - lastScan.current < 1500) return;
    lastScan.current = now;

    const id = parseTableId(data);
    const table = tables.data?.find((t) => t.id === id || t.name === id);
    if (!table) {
      toast.error('QR không hợp lệ', data.slice(0, 24));
      return;
    }
    setLocked(true);
    toast.success('Đã nhận bàn', table.name);
    router.replace(`/(app)/table/${table.id}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <Text className="text-xl font-extrabold text-white">Quét QR bàn</Text>
        <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-elevated active:opacity-70">
          <X size={22} color="#fff" />
        </Pressable>
      </View>

      {!permission ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted">Đang kiểm tra quyền camera…</Text>
        </View>
      ) : !permission.granted ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="mb-4 text-center text-muted">Cần quyền camera để quét mã QR bàn.</Text>
          <Button label="Cấp quyền camera" onPress={requestPermission} />
        </View>
      ) : (
        <View className="flex-1">
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={locked ? undefined : ({ data }) => onScan(data)}
          />
          {/* Khung ngắm */}
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
            <View className="h-60 w-60 rounded-3xl border-2 border-brand" />
            <Text className="mt-6 text-center text-white">Đưa mã QR trên bàn vào khung</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
