import { NativeModule, requireNativeModule } from 'expo';

export type SunmiStatus =
  | 'ready'
  | 'preparing'
  | 'comm_error'
  | 'out_of_paper'
  | 'overheated'
  | 'cover_open'
  | 'cutter_error'
  | 'cutter_recovered'
  | 'no_black_mark'
  | 'no_printer'
  | 'disconnected'
  | 'unknown';

declare class SunmiPrinterModule extends NativeModule<{}> {
  isDeviceSupported(): boolean;
  isConnected(): boolean;
  connect(): Promise<boolean>;
  disconnect(): Promise<boolean>;
  getStatus(): Promise<SunmiStatus>;
  printText(text: string): Promise<boolean>;
  printQRCode(data: string, moduleSize: number, errorLevel: number): Promise<boolean>;
  lineWrap(lines: number): Promise<boolean>;
  cutPaper(): Promise<boolean>;
}

export default requireNativeModule<SunmiPrinterModule>('SunmiPrinter');
