/**
 * Unified thermal-printer bridge.
 *
 * - Native (Capacitor Android wrapper): uses the @shoerofi/capacitor-bluetooth-serial
 *   SPP plugin to talk directly to an ALREADY-PAIRED ESC/POS printer by its MAC
 *   address — no device chooser, no scanning.
 * - Web (normal browser dev / PWA): falls back to Web Bluetooth (BLE).
 */

import { Capacitor } from '@capacitor/core';
import { BluetoothSerial, BluetoothConnectionState } from '@shoerofi/capacitor-bluetooth-serial';
import * as webBt from './bluetoothPrinter';

export interface PairedPrinter {
  id: string;
  name: string;
  address: string;
}

// ── Native SPP state ─────────────────────────────────────────────────────────
let nativeConnected = false;
let nativeAddress = '';
let nativeName = '';
let disconnectCb: (() => void) | null = null;

function isNativeMode(): boolean {
  try {
    return Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

/**
 * True when we can talk to a printer at all (native SPP or Web Bluetooth).
 */
export function isBluetoothAvailable(): boolean {
  return isNativeMode() ? true : webBt.isWebBluetoothAvailable();
}

/** True when running inside the Android (Capacitor) shell. */
export function isNativeShell(): boolean {
  return isNativeMode();
}

/** Whether the printer role UI should be shown at all. */
export function isSupported(): boolean {
  return isBluetoothAvailable();
}

/**
 * List printers already paired with the phone (native mode only).
 * Returns [] in the browser — there is no remote discovery here.
 */
export async function getPairedPrinters(): Promise<PairedPrinter[]> {
  if (!isNativeMode()) return [];
  try {
    const res = await BluetoothSerial.getPairedDevices();
    return (res.devices || []).map(d => ({
      id: d.address,
      name: d.name || d.id || d.address,
      address: d.address,
    }));
  } catch (err) {
    console.warn('Failed to read paired Bluetooth devices:', err);
    return [];
  }
}

/**
 * Connect to a printer.
 * Native: connect directly to the given paired device (no chooser).
 * Web: opens the Web Bluetooth device picker.
 * Resolves with the connected device name.
 */
export async function connect(device?: PairedPrinter): Promise<string> {
  if (isNativeMode()) {
    if (!device?.address) {
      throw new Error('Please choose a printer from your paired devices first.');
    }
    try {
      await BluetoothSerial.connectInsecure({ address: device.address });
    } catch {
      await BluetoothSerial.connect({ address: device.address });
    }
    nativeConnected = true;
    nativeAddress = device.address;
    nativeName = device.name;
    return nativeName;
  }
  // Fallback: Web Bluetooth chooser.
  const name = await webBt.connect();
  return name;
}

export function isConnected(): boolean {
  return isNativeMode() ? nativeConnected : webBt.isConnected();
}

export function getDeviceName(): string {
  return isNativeMode() ? nativeName : webBt.getPrinterName();
}

/** Register a callback triggered when the printer disconnects. */
export function onDisconnect(cb: () => void): void {
  disconnectCb = cb;
  if (isNativeMode()) {
    void BluetoothSerial.addListener('onConnectionChange', ev => {
      if (ev.state === BluetoothConnectionState.DISCONNECTED || ev.state === BluetoothConnectionState.CONNECTION_FAILED) {
        nativeConnected = false;
        nativeAddress = '';
        disconnectCb?.();
      }
    });
  } else {
    webBt.onDisconnect(cb);
  }
}

export function offDisconnect(): void {
  disconnectCb = null;
  if (!isNativeMode()) {
    webBt.offDisconnect();
  }
}

/** Send raw ESC/POS bytes to the printer. */
export async function send(data: Uint8Array): Promise<void> {
  if (!isConnected()) {
    throw new Error('Not connected to a printer');
  }
  if (isNativeMode()) {
    await BluetoothSerial.write({
      address: nativeAddress,
      value: bytesToLatin1(data),
      charset: 'ISO-8859-1',
    });
    return;
  }
  await webBt.send(data);
}

export async function disconnect(): Promise<void> {
  if (isNativeMode()) {
    if (nativeAddress) {
      try {
        await BluetoothSerial.disconnect({ address: nativeAddress });
      } catch {
        // ignore already-disconnected
      }
    }
    nativeConnected = false;
    nativeAddress = '';
    nativeName = '';
    disconnectCb?.();
    return;
  }
  webBt.disconnect();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Map each byte (0-255) to a single char so the plugin's ISO-8859-1 charset
// writes them as raw bytes (safe for binary ESC/POS data).
function bytesToLatin1(bytes: Uint8Array): string {
  let s = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return s;
}