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
  hriPosition: 0 | 1 | 2 | 3 = 3, // HRI text position: 0=none, 1=above, 2=below, 3=both
): Uint8Array {
  const typeMap: Record<BarcodeType, number> = {
    UPCA: 0, UPCE: 1, EAN13: 2, EAN8: 3,
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

// ── mm-aware thermal label builder ───────────────────────────────────────────

export interface ThermalLabelOptions {
  storeName: string;
  productName: string;
  barcodeValue: string;
  price: number;
  showStoreName?: boolean;
  showProductName?: boolean;
  showPrice?: boolean;
  showBarcodeText?: boolean;
  currencySymbol?: string;
  /** Physical paper width in mm (58 or 80). Determines printable width. */
  paperWidthMm?: number;
  /** Desired label width in mm (clamped to the paper's printable width). */
  labelWidthMm?: number;
  /** Desired label height (length) in mm. Drives paper feed before cutting. */
  labelHeightMm?: number;
  barcodeType?: BarcodeType;
  /** Barcode bar height in mm. */
  barcodeHeightMm?: number;
  cutMode?: 'full' | 'partial';
}

const DOTS_PER_MM = 8; // 203 dpi
const FONT_A_CHAR_DOTS = 12; // width of one font-A character
const FONT_A_LINE_DOTS = 24; // height of one font-A text line
const PRINTER_MARGIN_MM = 5; // printable area leaves ~5mm on each edge

function printableDotsForPaper(paperWidthMm: number): number {
  const printableMm = Math.max(paperWidthMm - PRINTER_MARGIN_MM * 2, 10);
  return Math.round(printableMm * DOTS_PER_MM);
}

/** Wrap text by words into lines of at most maxChars characters. */
function wrapLabelText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (candidate.length <= maxChars) {
      cur = candidate;
    } else {
      if (cur) lines.push(cur);
      if (w.length > maxChars) {
        let rest = w;
        while (rest.length > maxChars) {
          lines.push(rest.slice(0, maxChars));
          rest = rest.slice(maxChars);
        }
        cur = rest;
      } else {
        cur = w;
      }
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text.slice(0, maxChars)];
}

/**
 * Coerce a product barcode/SKU into something the chosen barcode type can
 * actually encode. Fixed-length numeric types are padded/truncated to digits.
 */
export function normalizeBarcodeValue(value: string, type: BarcodeType): string {
  const digits = value.replace(/\D/g, '');
  switch (type) {
    case 'EAN13': return digits.slice(0, 13).padStart(13, '0');
    case 'EAN8': return digits.slice(0, 8).padStart(8, '0');
    case 'UPCA': return digits.slice(0, 12).padStart(12, '0');
    case 'UPCE': return digits.slice(0, 8).padStart(8, '0');
    case 'ITF': {
      const even = digits.length % 2 === 0 ? digits : digits.slice(0, -1);
      return even || '0000';
    }
    default: {
      const clean = (value || '000000').toUpperCase().replace(/[^A-Z0-9\-\.\ \/\+%]/g, '');
      return clean || '000000';
    }
  }
}

/**
 * Build a complete ESC/POS sequence for ONE self-adhesive thermal label sized
 * in millimetres. Computes the printable character grid from the requested
 * width, wraps/truncates text to fit, accounts for the barcode + HRI height,
 * then feeds the remaining paper so each label comes out at labelHeightMm.
 */
export function buildThermalLabel(opts: ThermalLabelOptions): Uint8Array {
  const {
    storeName = '',
    productName = '',
    barcodeValue = '000000',
    price = 0,
    showStoreName = true,
    showProductName = true,
    showPrice = true,
    showBarcodeText = true,
    currencySymbol = 'Ks',
    paperWidthMm = 58,
    labelWidthMm = 50,
    labelHeightMm = 25,
    barcodeType = 'CODE128',
    barcodeHeightMm = 10,
    cutMode = 'full',
  } = opts;

  const printableDots = printableDotsForPaper(paperWidthMm);
  const labelWidthDots = Math.min(Math.max(Math.round(labelWidthMm * DOTS_PER_MM), 1), printableDots);
  const labelHeightDots = Math.max(Math.round(labelHeightMm * DOTS_PER_MM), 24);
  const charsPerLine = Math.max(Math.floor(labelWidthDots / FONT_A_CHAR_DOTS), 4);

  const cmds: Uint8Array[] = [];
  cmds.push(resetFormat());
  cmds.push(new Uint8Array([0x1b, 0x61, 1])); // ESC a 1 → center

  let usedDots = 0;

  // Store / header text
  if (showStoreName && storeName) {
    const line = storeName.length > charsPerLine ? `${storeName.slice(0, charsPerLine - 1)}…` : storeName;
    cmds.push(text(line, { align: 'center', bold: true, width: 1, height: 1 }));
    usedDots += FONT_A_LINE_DOTS;
  }

  // Product name (wrapped; limited by remaining vertical space)
  if (showProductName && productName) {
    const barcodeDots = Math.max(Math.round(barcodeHeightMm * DOTS_PER_MM), 20);
    const hriDots = showBarcodeText ? FONT_A_LINE_DOTS : 0;
    const priceDots = showPrice ? FONT_A_LINE_DOTS : 0;
    const fixedDots = (showStoreName && storeName ? FONT_A_LINE_DOTS : 0) + barcodeDots + hriDots + priceDots;
    const remainingDots = Math.max(labelHeightDots - fixedDots, 0);
    const maxLines = Math.max(Math.floor(remainingDots / FONT_A_LINE_DOTS), 1);

    let lines = wrapLabelText(productName, charsPerLine);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      if (lines[maxLines - 1].length >= charsPerLine) {
        lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, charsPerLine - 1)}…`;
      }
    }
    for (const line of lines) {
      cmds.push(text(line, { align: 'center', bold: true, width: 1, height: 1 }));
    }
    usedDots += lines.length * FONT_A_LINE_DOTS;
  }

  // Barcode (printer-native engine)
  const barcodeHeightDots = Math.max(Math.round(barcodeHeightMm * DOTS_PER_MM), 20);
  cmds.push(barcode(normalizeBarcodeValue(barcodeValue, barcodeType), barcodeType, barcodeHeightDots, showBarcodeText ? 2 : 0));
  usedDots += barcodeHeightDots + (showBarcodeText ? FONT_A_LINE_DOTS : 0);

  // Price footer
  if (showPrice) {
    const priceStr = `${Number(price).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currencySymbol}`.trim();
    const fits = priceStr.length * 24 <= labelWidthDots;
    cmds.push(text(priceStr, { align: 'center', bold: true, width: fits ? 2 : 1, height: 1 }));
    usedDots += FONT_A_LINE_DOTS;
  }

  // Feed to the requested label height, then cut
  const remainingDots = Math.max(labelHeightDots - usedDots, 0);
  if (remainingDots > 0) cmds.push(feedDots(remainingDots));
  cmds.push(cutMode === 'partial' ? partialCut() : cut());

  return concat(...cmds);
}

/** Build ESC/POS for many thermal labels (init + codepage once, then each label). */
export function buildThermalLabels(labels: ThermalLabelOptions[]): Uint8Array {
  return concat(
    init(),
    setCodePage('CP437'),
    ...labels.map(l => buildThermalLabel(l)),
  );
}
