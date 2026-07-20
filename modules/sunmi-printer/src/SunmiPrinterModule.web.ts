import { registerWebModule, NativeModule } from 'expo';

import type { SunmiStatus } from './SunmiPrinterModule';

// Không có máy in Sunmi trên web/máy thường → no-op, isDeviceSupported=false.
class SunmiPrinterModule extends NativeModule<{}> {
  isDeviceSupported(): boolean {
    return false;
  }
  isConnected(): boolean {
    return false;
  }
  async connect(): Promise<boolean> {
    return false;
  }
  async disconnect(): Promise<boolean> {
    return true;
  }
  async getStatus(): Promise<SunmiStatus> {
    return 'disconnected';
  }
  async printText(): Promise<boolean> {
    return false;
  }
  async printQRCode(): Promise<boolean> {
    return false;
  }
  async lineWrap(): Promise<boolean> {
    return false;
  }
  async cutPaper(): Promise<boolean> {
    return false;
  }
}

export default registerWebModule(SunmiPrinterModule, 'SunmiPrinterModule');
