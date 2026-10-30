export type LiveHeartRateSample = {
  bpm: number;
  receivedAt: number;
  sensorContact: 'detected' | 'not-detected' | 'unknown';
};

type BleCharacteristic = EventTarget & {
  value?: DataView;
  startNotifications(): Promise<BleCharacteristic>;
  stopNotifications(): Promise<BleCharacteristic>;
};

type BleService = {
  getCharacteristic(uuid: number): Promise<BleCharacteristic>;
};

type BleServer = {
  connected: boolean;
  connect(): Promise<BleServer>;
  disconnect(): void;
  getPrimaryService(uuid: number): Promise<BleService>;
};

type BleDevice = EventTarget & {
  name?: string | null;
  gatt?: BleServer | null;
};

type BleApi = {
  requestDevice(options: { filters: Array<{ services: number[] }> }): Promise<BleDevice>;
};

export type HeartRateConnection = {
  deviceName: string;
  disconnect: () => Promise<void>;
};

const HEART_RATE_SERVICE = 0x180d;
const HEART_RATE_MEASUREMENT = 0x2a37;

export function isHeartRateBluetoothAvailable() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !window.isSecureContext) return false;
  return typeof (navigator as Navigator & { bluetooth?: BleApi }).bluetooth?.requestDevice === 'function';
}

export function parseHeartRatePacket(data: DataView): Omit<LiveHeartRateSample, 'receivedAt'> | null {
  if (data.byteLength < 2) return null;
  const flags = data.getUint8(0);
  const isUint16 = (flags & 0x01) !== 0;
  const bpmOffset = 1;
  const requiredLength = bpmOffset + (isUint16 ? 2 : 1);
  if (data.byteLength < requiredLength) return null;

  const bpm = isUint16 ? data.getUint16(bpmOffset, true) : data.getUint8(bpmOffset);
  if (bpm === 0) return null;

  const contactSupported = (flags & 0x04) !== 0;
  const contactDetected = (flags & 0x02) !== 0;
  return {
    bpm,
    sensorContact: contactSupported ? contactDetected ? 'detected' : 'not-detected' : 'unknown',
  };
}

export async function connectHeartRateDevice(
  onSample: (sample: LiveHeartRateSample) => void,
  onDisconnect: () => void,
): Promise<HeartRateConnection> {
  if (!isHeartRateBluetoothAvailable()) throw new Error('Bluetooth heart-rate monitoring is unavailable in this browser.');

  const bluetooth = (navigator as Navigator & { bluetooth?: BleApi }).bluetooth;
  if (!bluetooth) throw new Error('Bluetooth heart-rate monitoring is unavailable in this browser.');

  const device = await bluetooth.requestDevice({ filters: [{ services: [HEART_RATE_SERVICE] }] });
  const server = device.gatt;
  if (!server) throw new Error('This wearable did not provide a Bluetooth connection.');

  let characteristic: BleCharacteristic | undefined;
  let disconnectedByUser = false;
  const handleDisconnect = () => { if (!disconnectedByUser) onDisconnect(); };
  const handleMeasurement = (event: Event) => {
    const source = (event.currentTarget ?? event.target) as BleCharacteristic | null;
    if (!source?.value) return;
    const parsed = parseHeartRatePacket(source.value);
    if (parsed) onSample({ ...parsed, receivedAt: Date.now() });
  };

  device.addEventListener('gattserverdisconnected', handleDisconnect);
  try {
    await server.connect();
    const service = await server.getPrimaryService(HEART_RATE_SERVICE);
    characteristic = await service.getCharacteristic(HEART_RATE_MEASUREMENT);
    characteristic.addEventListener('characteristicvaluechanged', handleMeasurement);
    await characteristic.startNotifications();
  } catch (error) {
    device.removeEventListener('gattserverdisconnected', handleDisconnect);
    if (server.connected) server.disconnect();
    throw error;
  }

  return {
    deviceName: device.name?.trim() || 'Heart-rate wearable',
    disconnect: async () => {
      disconnectedByUser = true;
      characteristic?.removeEventListener('characteristicvaluechanged', handleMeasurement);
      device.removeEventListener('gattserverdisconnected', handleDisconnect);
      if (characteristic) await characteristic.stopNotifications().catch(() => undefined);
      if (server.connected) server.disconnect();
    },
  };
}
