/**
 * Web Bluetooth API manager for connecting to ESC/POS thermal printers.
 * Works on Chrome/Edge for Android (HTTPS required).
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface BluetoothPrinterState {
  device: BluetoothDevice | null;
  characteristic: BluetoothRemoteGATTCharacteristic | null;
  server: BluetoothRemoteGATTServer | null;
  connected: boolean;
  printerName: string;
}

export type DisconnectCallback = () => void;

// ── Common service UUIDs for Bluetooth serial printers ───────────────────────

const SERIAL_PORT_SERVICE = '00001101-0000-1000-8000-00805f9b34fb';
const SPP_UUID = '00001101-0000-1000-8000-00805f9b34fb';

// Generic serial / SPP fallback services many cheap printers use
const FALLBACK_SERVICES = [
  SERIAL_PORT_SERVICE,
  '0000fee7-0000-1000-8000-00805f9b34fb', // Common for Chinese BLE printers
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART (used by some)
];

// ── Singleton state ──────────────────────────────────────────────────────────

let state: BluetoothPrinterState = {
  device: null,
  characteristic: null,
  server: null,
  connected: false,
  printerName: '',
};

let onDisconnectCb: DisconnectCallback | null = null;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Check if Web Bluetooth is available in this browser.
 */
export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;
}

/**
 * Check if currently connected to a printer.
 */
export function isConnected(): boolean {
  return state.connected && state.characteristic !== null;
}

/**
 * Get the name of the currently connected printer.
 */
export function getPrinterName(): string {
  return state.printerName;
}

/**
 * Register a callback for when the printer disconnects.
 */
export function onDisconnect(cb: DisconnectCallback): void {
  onDisconnectCb = cb;
}

/**
 * Remove the disconnect callback.
 */
export function offDisconnect(): void {
  onDisconnectCb = null;
}

/**
 * Request a Bluetooth device and connect to its serial port.
 * Shows the Android Bluetooth device picker.
 */
export async function connect(): Promise<string> {
  let device: BluetoothDevice;

  try {
    // Try with serial port service filter first (works for most ESC/POS printers)
    device = await (navigator as any).bluetooth.requestDevice({
      filters: [
        { services: [SERIAL_PORT_SERVICE] },
      ],
      optionalServices: [
        SERIAL_PORT_SERVICE,
        ...FALLBACK_SERVICES,
      ],
    });
  } catch {
    // Fallback: show all devices (some printers don't advertise serial service)
    device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        SERIAL_PORT_SERVICE,
        ...FALLBACK_SERVICES,
      ],
    });
  }

  if (!device.gatt) {
    throw new Error('Device does not support GATT');
  }

  // Listen for disconnect
  device.addEventListener('gattserverdisconnected', handleDisconnect);

  // Connect to GATT server
  const server = await device.gatt.connect();

  // Try to get the serial port service
  let characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  // Try each possible service UUID
  for (const serviceUuid of [SERIAL_PORT_SERVICE, ...FALLBACK_SERVICES]) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      // Look for a writable characteristic
      const chars = await service.getCharacteristics();
      for (const c of chars) {
        if (c.properties.write || c.properties.writeWithoutResponse) {
          characteristic = c;
          break;
        }
      }
      if (characteristic) break;
    } catch {
      // Service not found, try next
      continue;
    }
  }

  if (!characteristic) {
    server.disconnect();
    throw new Error(
      'Could not find a writable characteristic. ' +
      'Your printer may not be a supported ESC/POS printer.'
    );
  }

  state = {
    device,
    server,
    characteristic,
    connected: true,
    printerName: device.name || 'Unknown Printer',
  };

  return state.printerName;
}

/**
 * Send raw bytes to the connected printer.
 * Handles chunking for printers with small MTU.
 */
export async function send(data: Uint8Array): Promise<void> {
  if (!state.characteristic) {
    throw new Error('Not connected to a printer');
  }

  const characteristic = state.characteristic;

  // Determine max write length
  // BLE has MTU limit; most ESC/POS Bluetooth printers accept 20 bytes at a time
  // Some support longer writes via writeWithoutResponse
  const supportsWriteWithoutResponse = characteristic.properties.writeWithoutResponse;
  const maxChunkSize = 20; // Safe default for BLE

  let offset = 0;
  while (offset < data.length) {
    const chunk = data.slice(offset, offset + maxChunkSize);

    if (supportsWriteWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValueWithResponse(chunk);
    }

    offset += maxChunkSize;

    // Small delay between chunks to avoid overwhelming the printer
    if (offset < data.length) {
      await sleep(10);
    }
  }
}

/**
 * Send a Uint8Array with a progress callback.
 */
export async function sendWithProgress(
  data: Uint8Array,
  onProgress?: (sent: number, total: number) => void,
): Promise<void> {
  if (!state.characteristic) {
    throw new Error('Not connected to a printer');
  }

  const characteristic = state.characteristic;
  const supportsWriteWithoutResponse = characteristic.properties.writeWithoutResponse;
  const maxChunkSize = 20;

  let offset = 0;
  while (offset < data.length) {
    const chunk = data.slice(offset, offset + maxChunkSize);

    if (supportsWriteWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValueWithResponse(chunk);
    }

    offset += maxChunkSize;
    onProgress?.(Math.min(offset, data.length), data.length);

    if (offset < data.length) {
      await sleep(10);
    }
  }
}

/**
 * Disconnect from the printer.
 */
export function disconnect(): void {
  if (state.device?.gatt?.connected) {
    state.device.gatt.disconnect();
  }
  handleDisconnect();
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function handleDisconnect(): void {
  state = {
    device: null,
    characteristic: null,
    server: null,
    connected: false,
    printerName: '',
  };
  onDisconnectCb?.();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
