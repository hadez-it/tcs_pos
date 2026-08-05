/**
 * ESC/POS command builder for thermal receipt printers.
 * Generates raw byte arrays to send over Bluetooth serial.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function strToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ── Base commands ────────────────────────────────────────────────────────────

/** Initialize / reset printer to defaults */
export function init(): Uint8Array {
  return new Uint8Array([0x1b, 0x40]); // ESC @
}

/** Set code page (e.g., 'CP437', 'CP1252', 'CP850') */
export function setCodePage(page: string = 'CP437'): Uint8Array {
  const pages: Record<string, number> = {
    CP437: 0, CP850: 13, CP1252: 16, CP860: 15, CP866: 17,
    GB18030: 26, BIG5: 28, SHIFT_JIS: 31, EUC_KR: 30,
  };
  const n = pages[page.toUpperCase()] ?? 0;
  return new Uint8Array([0x1b, 0x74, n]); // ESC t n
}

// ── Text formatting ──────────────────────────────────────────────────────────

export type Align = 'left' | 'center' | 'right';

interface TextOptions {
  align?: Align;
  bold?: boolean;
  underline?: 0 | 1 | 2; // 0=off, 1=1dot, 2=2dot
  width?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  height?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  invert?: boolean;
}

export function text(str: string, opts: TextOptions = {}): Uint8Array {
  const cmds: Uint8Array[] = [];

  // Alignment
  if (opts.align) {
    const a = opts.align === 'center' ? 1 : opts.align === 'right' ? 2 : 0;
    cmds.push(new Uint8Array([0x1b, 0x61, a])); // ESC a n
  }

  // Bold
  cmds.push(new Uint8Array([0x1b, 0x45, opts.bold ? 1 : 0])); // ESC E n

  // Underline
  cmds.push(new Uint8Array([0x1b, 0x2d, opts.underline ?? 0])); // ESC - n

  // Character size (GS ! n)
  // width in upper nibble, height in lower nibble
  const w = (opts.width ?? 1) - 1;
  const h = (opts.height ?? 1) - 1;
  cmds.push(new Uint8Array([0x1d, 0x21, (w << 4) | h]));

  // Inverse (white on black)
  cmds.push(new Uint8Array([0x1d, 0x42, opts.invert ? 1 : 0])); // GS B n

  // Actual text
  cmds.push(strToBytes(str));
  cmds.push(strToBytes('\n'));

  return concat(...cmds);
}

/** Reset formatting to defaults (normal size, not bold, no underline, left) */
export function resetFormat(): Uint8Array {
  return concat(
    new Uint8Array([0x1b, 0x61, 0]), // left align
    new Uint8Array([0x1b, 0x45, 0]), // no bold
    new Uint8Array([0x1b, 0x2d, 0]), // no underline
    new Uint8Array([0x1d, 0x21, 0]), // 1x1 size
    new Uint8Array([0x1d, 0x42, 0]), // no inverse
  );
}

// ── Horizontal line / separator ──────────────────────────────────────────────

export function separator(char: string = '-', width: number = 32): Uint8Array {
  return text(char.repeat(width), { align: 'left' });
}

// ── Barcode ──────────────────────────────────────────────────────────────────

/**
 * Print a barcode using the printer's native barcode engine.
 * GS k m d1...dk NUL   (type 0 = CODE39)
 * GS k m n d1...dk      (type 65 = CODE39, type 73 = CODE128)
 *
 * Barcode types:
 *   0  = UPC-A      4  = ITF       65 = CODE39
 *   1  = UPC-E      5  = CODE93    73 = CODE128
 *   2  = EAN13      6  = CODE128   72 = CODE128 AUTO
 *   3  = EAN8
 */
export type BarcodeType = 'CODE39' | 'CODE128' | 'EAN13' | 'EAN8' | 'UPCA' | 'UPCE' | 'ITF' | 'CODE93';

export function barcode(
  data: string,
  type: BarcodeType = 'CODE39',
  height: number = 50, // barcode bar height in dots (default ~50 dots for 58mm printers)
  hriPosition: 1 | 2 | 3 = 3, // HRI text position: 1=above, 2=below, 3=both, 0=none
): Uint8Array {
  const typeMap: Record<BarcodeType, number> = {
    UPC_A: 0, UPC_E: 1, EAN13: 2, EAN8: 3,
    ITF: 4, CODE93: 5, CODE128: 6, CODE39: 7,
  };

  // For GS k commands, we use the "function B" variants:
  // GS k m d1...dk 0   (m=0..6, NUL-terminated)
  // GS k m n d1...dk   (m=65..73, length-prefixed)
  const m = typeMap[type]; // 0-6
  const mB = typeMap[type] + 65; // 65-73 for function B

  const dataBytes = strToBytes(data);
  const cmds: Uint8Array[] = [];

  // Set barcode height (GS h n)
  cmds.push(new Uint8Array([0x1d, 0x68, height & 0xff]));

  // Set HRI text position (GS H n)
  cmds.push(new Uint8Array([0x1d, 0x48, hriPosition]));

  // Set barcode width (GS w n) — n=2 is common for 58mm printers
  cmds.push(new Uint8Array([0x1d, 0x77, 2]));

  // Print barcode (function B: GS k m n d1...dk)
  const cmd = new Uint8Array(4 + dataBytes.length);
  cmd[0] = 0x1d; // GS
  cmd[1] = 0x6b; // k
  cmd[2] = mB;   // type (function B)
  cmd[3] = dataBytes.length;
  cmd.set(dataBytes, 4);
  cmds.push(cmd);

  return concat(...cmds);
}

// ── Paper control ────────────────────────────────────────────────────────────

/** Feed paper by n lines */
export function feed(n: number = 3): Uint8Array {
  return new Uint8Array([0x1b, 0x64, n & 0xff]); // ESC d n
}

/** Feed paper by n dot lines */
export function feedDots(n: number): Uint8Array {
  const high = (n >> 8) & 0xff;
  const low = n & 0xff;
  return new Uint8Array([0x1b, 0x4a, low, high]); // ESC J nL nH
}

/** Cut paper (full cut) */
export function cut(): Uint8Array {
  return new Uint8Array([0x1d, 0x56, 0]); // GS V 0
}

/** Partial cut (if supported) */
export function partialCut(): Uint8Array {
  return new Uint8Array([0x1d, 0x56, 1]); // GS V 1
}

// ── High-level label builder ─────────────────────────────────────────────────

interface LabelOptions {
  storeName: string;
  productName: string;
  barcodeValue: string;
  price: number;
  showStoreName?: boolean;
  showProductName?: boolean;
  showPrice?: boolean;
  showBarcodeText?: boolean;
  currencySymbol?: string;
}

/**
 * Build a complete ESC/POS command sequence for a single barcode label.
 * Designed for thermal printers (58mm or 80mm).
 */
export function buildLabel(opts: LabelOptions): Uint8Array {
  const {
    storeName,
    productName,
    barcodeValue,
    price,
    showStoreName = true,
    showProductName = true,
    showPrice = true,
    showBarcodeText = true,
    currencySymbol = '$',
  } = opts;

  const cmds: Uint8Array[] = [];

  cmds.push(resetFormat());

  // Store name header
  if (showStoreName) {
    cmds.push(text(storeName, {
      align: 'center',
      bold: true,
      width: 2,
      height: 1,
    }));
  }

  // Separator
  cmds.push(separator('-', 32));

  // Product name
  if (showProductName) {
    // Truncate long names to fit ~32 chars (58mm) or ~48 chars (80mm)
    const maxLen = 32;
    const name = productName.length > maxLen
      ? productName.slice(0, maxLen - 1) + '…'
      : productName;
    cmds.push(text(name, {
      align: 'center',
      bold: true,
      width: 1,
      height: 1,
    }));
  }

  // Barcode (use printer-native CODE39 for best quality)
  cmds.push(barcode(barcodeValue, 'CODE39', 60, showBarcodeText ? 2 : 0));

  // Price
  if (showPrice) {
    const priceStr = `${currencySymbol}${Number(price).toFixed(2)}`;
    cmds.push(text(priceStr, {
      align: 'center',
      bold: true,
      width: 2,
      height: 1,
    }));
  }

  // Feed + cut
  cmds.push(feed(3));
  cmds.push(cut());

  return concat(...cmds);
}

/**
 * Build ESC/POS for multiple labels.
 * Each label is separated by a cut command.
 */
export function buildMultiLabel(labels: LabelOptions[]): Uint8Array {
  return concat(
    init(),
    setCodePage('CP437'),
    ...labels.map(l => buildLabel(l)),
  );
}
