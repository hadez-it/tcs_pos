import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer, X, Search, CheckSquare, Square, Settings2,
  Tag, Bluetooth, BluetoothOff, Loader2, CheckCircle2, AlertCircle,
  Minus, Plus, Ruler, Scissors,
} from 'lucide-react';
import { Product } from '../types';
import BarcodeSVG from './BarcodeSVG';
import * as printerBridge from '../lib/printerBridge';
import {
  buildThermalLabel, init as escInit, setCodePage, feedPitch,
  BarcodeType, normalizeBarcodeValue, getPrintableMm, testPrint,
} from '../lib/escpos';

interface BarcodePrintModalProps {
  products: Product[];
  isOpen: boolean;
  onClose: () => void;
  selectedProductId?: string | null;
  currencySymbol?: string;
  businessName?: string;
}

const BARCODE_TYPES: { value: BarcodeType; label: string }[] = [
  { value: 'CODE128', label: 'CODE128' },
  { value: 'CODE39', label: 'CODE39' },
  { value: 'EAN13', label: 'EAN13' },
  { value: 'EAN8', label: 'EAN8' },
  { value: 'UPCA', label: 'UPC-A' },
  { value: 'UPCE', label: 'UPC-E' },
  { value: 'ITF', label: 'ITF' },
  { value: 'CODE93', label: 'CODE93' },
];

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
const parseMm = (v: string) => {
  const n = parseFloat(v);
  return isFinite(n) && n > 0 ? n : 0;
};

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  products,
  isOpen,
  onClose,
  selectedProductId,
  currencySymbol = 'Ks',
  businessName,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [storeName, setStoreName] = useState(businessName || 'My Retail Store');

  const [selectedProducts, setSelectedProducts] = useState<{ [id: string]: number }>(() => {
    const initialMap: { [id: string]: number } = {};
    if (selectedProductId) {
      const prod = products.find(p => p.id === selectedProductId);
      if (prod) initialMap[prod.id] = 1;
    } else {
      products.forEach(p => { initialMap[p.id] = 1; });
    }
    return initialMap;
  });

  const [showStoreName, setShowStoreName] = useState(true);
  const [showProductName, setShowProductName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showCodeText, setShowCodeText] = useState(true);

  // ── Paper mode: sticker labels vs continuous receipt ───────────────────────
  const [paperMode, setPaperMode] = useState<'sticker' | 'receipt'>('sticker');

  // ── Custom paper size (mm) ──────────────────────────────────────────────────
  const [paperWidth, setPaperWidth] = useState<'32' | '58' | '80'>('80');
  const [labelWidth, setLabelWidth] = useState('80');
  const [labelHeight, setLabelHeight] = useState('30');
  const [barcodeWidth, setBarcodeWidth] = useState('80');
  const [barcodeHeight, setBarcodeHeight] = useState('10');
  const [barcodeType, setBarcodeType] = useState<BarcodeType>('CODE39');
  const [cutMode, setCutMode] = useState<'off' | 'full' | 'partial'>('off');
  const [labelGap, setLabelGap] = useState('3');
  const [feedOffset, setFeedOffset] = useState('0');

  // ── Custom X/Y design layout ───────────────────────────────────────────────
  const [customLayout, setCustomLayout] = useState(false);
  const [layoutXY, setLayoutXY] = useState<{
    store: { x: string; y: string }; product: { x: string; y: string };
    barcode: { x: string; y: string }; price: { x: string; y: string };
  }>({
    store: { x: '0', y: '0' },
    product: { x: '0', y: '6' },
    barcode: { x: '0', y: '12' },
    price: { x: '0', y: '24' },
  });
  const [fontSize, setFontSize] = useState<{ store: 1 | 2; product: 1 | 2; price: 1 | 2 }>({
    store: 1, product: 1, price: 2,
  });

  const [dragState, setDragState] = useState<{
    type: 'move-barcode' | 'resize-barcode-e' | 'resize-barcode-s' | 'resize-barcode-se' | 'move-store' | 'move-product' | 'move-price';
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialW: number;
    initialH: number;
    initialStoreX: number;
    initialStoreY: number;
    initialProdX: number;
    initialProdY: number;
    initialPriceX: number;
    initialPriceY: number;
  } | null>(null);

  // ── Printer state (native SPP in Android shell, Web BT in browser) ────────
  const isNative = printerBridge.isNativeShell();
  const [btAvailable] = useState(() => printerBridge.isBluetoothAvailable());
  const [btConnected, setBtConnected] = useState(() => printerBridge.isConnected());
  const [printerName, setPrinterName] = useState(() => printerBridge.getDeviceName());
  const [btConnecting, setBtConnecting] = useState(false);
  const [btPrinting, setBtPrinting] = useState(false);
  const [btProgress, setBtProgress] = useState({ current: 0, total: 0 });
  const [btError, setBtError] = useState<string | null>(null);
  const [pairedDevices, setPairedDevices] = useState<printerBridge.PairedPrinter[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');

  // ── Derived dimensions ──────────────────────────────────────────────────────
  const effPaperWidth = paperWidth === '80' ? 80 : paperWidth === '58' ? 58 : 32;
  const printableMm = getPrintableMm(effPaperWidth);
  const effLabelWidth = clamp(parseMm(labelWidth) || effPaperWidth, 5, 80);
  const effLabelHeight = clamp(parseMm(labelHeight) || 30, 8, 300);

  const rawBcW = parseMm(barcodeWidth) || effLabelWidth;
  const effBarcodeWidth = clamp(rawBcW, 10, effLabelWidth);

  const rawBcH = parseMm(barcodeHeight) || 10;
  const effBarcodeHeight = clamp(rawBcH, 3, effLabelHeight);

  const rawBcX = parseMm(layoutXY.barcode.x) || 0;
  const effBarcodeX = clamp(rawBcX, 0, Math.max(0, effLabelWidth - effBarcodeWidth));

  const rawBcY = parseMm(layoutXY.barcode.y) || 0;
  const effBarcodeY = clamp(rawBcY, 0, Math.max(0, effLabelHeight - effBarcodeHeight));

  const effLabelGap = clamp(parseMm(labelGap) || 3, 2, 10);
  const effFeedOffset = clamp(parseMm(feedOffset) || 0, -10, 10);

  const effLayoutX = (k: 'store' | 'product' | 'price') => clamp(parseMm(layoutXY[k].x) || 0, 0, Math.max(0, effLabelWidth - 5));
  const effLayoutY = (k: 'store' | 'product' | 'price') => clamp(parseMm(layoutXY[k].y) || 0, 0, Math.max(0, effLabelHeight - 3));

  const layoutForPrint = customLayout
    ? {
        storeName: showStoreName ? { xMm: effLayoutX('store'), yMm: effLayoutY('store'), size: fontSize.store } : undefined,
        productName: showProductName ? { xMm: effLayoutX('product'), yMm: effLayoutY('product'), size: fontSize.product } : undefined,
        barcode: { xMm: effBarcodeX, yMm: effBarcodeY, widthMm: effBarcodeWidth, heightMm: effBarcodeHeight },
        price: showPrice ? { xMm: effLayoutX('price'), yMm: effLayoutY('price'), size: fontSize.price } : undefined,
      }
    : undefined;

  const printItemsList: Array<{ product: Product; labelIndex: number }> = [];
  Object.entries(selectedProducts).forEach(([prodId, rawQty]) => {
    const qty = Number(rawQty) || 0;
    const prod = products.find(p => p.id === prodId);
    if (prod && qty > 0) {
      for (let i = 0; i < qty; i++) {
        printItemsList.push({ product: prod, labelIndex: i + 1 });
      }
    }
  });

  useEffect(() => {
    if (!isOpen) return;
    if (isNative) {
      printerBridge.getPairedPrinters().then(devs => {
        setPairedDevices(devs);
        if (devs.length > 0) setSelectedAddress(devs[0].address);
      }).catch(() => {});
    }
    printerBridge.onDisconnect(() => {
      setBtConnected(false);
      setPrinterName('');
    });
    return () => {
      printerBridge.offDisconnect();
    };
  }, [isOpen, isNative]);

  const handleConnectPrinter = useCallback(async () => {
    if (btConnecting) return;
    setBtError(null);
    setBtConnecting(true);
    try {
      const device = pairedDevices.find(d => d.address === selectedAddress);
      const name = await printerBridge.connect(device);
      setBtConnected(true);
      setPrinterName(name);
      setBtError(null);
    } catch (err: any) {
      if (err?.name === 'NotFoundError') {
        setBtError(null);
      } else {
        setBtError(err?.message || 'Failed to connect to printer');
      }
    } finally {
      setBtConnecting(false);
    }
  }, [btConnecting, pairedDevices, selectedAddress]);

  const handleDisconnectPrinter = useCallback(async () => {
    await printerBridge.disconnect();
    setBtConnected(false);
    setPrinterName('');
  }, []);

  const previewScale = Math.min(240 / effLabelWidth, 5);
  const previewW = Math.round(effLabelWidth * previewScale);
  const previewH = Math.round(effLabelHeight * previewScale);

  const handlePointerDown = (
    e: React.PointerEvent,
    type: 'move-barcode' | 'resize-barcode-e' | 'resize-barcode-s' | 'resize-barcode-se' | 'move-store' | 'move-product' | 'move-price'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    setDragState({
      type,
      startX: e.clientX,
      startY: e.clientY,
      initialX: effBarcodeX,
      initialY: effBarcodeY,
      initialW: effBarcodeWidth,
      initialH: effBarcodeHeight,
      initialStoreX: effLayoutX('store'),
      initialStoreY: effLayoutY('store'),
      initialProdX: effLayoutX('product'),
      initialProdY: effLayoutY('product'),
      initialPriceX: effLayoutX('price'),
      initialPriceY: effLayoutY('price'),
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState) return;
    const dxMm = (e.clientX - dragState.startX) / previewScale;
    const dyMm = (e.clientY - dragState.startY) / previewScale;

    if (dragState.type === 'move-barcode') {
      const maxW = effBarcodeWidth;
      const maxH = effBarcodeHeight;
      const newX = clamp(dragState.initialX + dxMm, 0, Math.max(0, effLabelWidth - maxW));
      const newY = clamp(dragState.initialY + dyMm, 0, Math.max(0, effLabelHeight - maxH));
      setLayoutXY(prev => ({
        ...prev,
        barcode: { x: newX.toFixed(1), y: newY.toFixed(1) }
      }));
    } else if (dragState.type === 'resize-barcode-e') {
      const maxW = Math.max(10, effLabelWidth - effBarcodeX);
      const newW = clamp(dragState.initialW + dxMm, 10, maxW);
      setBarcodeWidth(newW.toFixed(1));
    } else if (dragState.type === 'resize-barcode-s') {
      const maxH = Math.max(3, effLabelHeight - effBarcodeY);
      const newH = clamp(dragState.initialH + dyMm, 3, maxH);
      setBarcodeHeight(newH.toFixed(1));
    } else if (dragState.type === 'resize-barcode-se') {
      const maxW = Math.max(10, effLabelWidth - effBarcodeX);
      const maxH = Math.max(3, effLabelHeight - effBarcodeY);
      const newW = clamp(dragState.initialW + dxMm, 10, maxW);
      const newH = clamp(dragState.initialH + dyMm, 3, maxH);
      setBarcodeWidth(newW.toFixed(1));
      setBarcodeHeight(newH.toFixed(1));
    } else if (dragState.type === 'move-store') {
      const newX = clamp(dragState.initialStoreX + dxMm, 0, Math.max(0, effLabelWidth - 5));
      const newY = clamp(dragState.initialStoreY + dyMm, 0, Math.max(0, effLabelHeight - 3));
      setLayoutXY(prev => ({ ...prev, store: { x: newX.toFixed(1), y: newY.toFixed(1) } }));
    } else if (dragState.type === 'move-product') {
      const newX = clamp(dragState.initialProdX + dxMm, 0, Math.max(0, effLabelWidth - 5));
      const newY = clamp(dragState.initialProdY + dyMm, 0, Math.max(0, effLabelHeight - 3));
      setLayoutXY(prev => ({ ...prev, product: { x: newX.toFixed(1), y: newY.toFixed(1) } }));
    } else if (dragState.type === 'move-price') {
      const newX = clamp(dragState.initialPriceX + dxMm, 0, Math.max(0, effLabelWidth - 5));
      const newY = clamp(dragState.initialPriceY + dyMm, 0, Math.max(0, effLabelHeight - 3));
      setLayoutXY(prev => ({ ...prev, price: { x: newX.toFixed(1), y: newY.toFixed(1) } }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragState) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setDragState(null);
    }
  };

  const labelOptionsFor = (product: Product) => ({
    storeName,
    productName: product.name,
    barcodeValue: product.barcode || product.sku || '000000',
    price: product.price,
    showStoreName,
    showProductName,
    showPrice,
    showBarcodeText: showCodeText,
    currencySymbol,
    paperWidthMm: effPaperWidth,
    labelWidthMm: effLabelWidth,
    labelHeightMm: effLabelHeight,
    barcodeType,
    barcodeWidthMm: effBarcodeWidth,
    barcodeHeightMm: effBarcodeHeight,
    cutMode: paperMode === 'sticker' ? 'off' : cutMode,
    paperMode,
    labelGapMm: effLabelGap,
    feedOffsetMm: effFeedOffset,
    layout: layoutForPrint,
  });

  const handleBtPrint = useCallback(async () => {
    if (!printerBridge.isConnected() || printItemsList.length === 0 || btPrinting) return;

    setBtPrinting(true);
    setBtError(null);
    setBtProgress({ current: 0, total: printItemsList.length });

    try {
      await new Promise(r => setTimeout(r, 400));
      await printerBridge.send(escInit());
      await printerBridge.send(setCodePage('CP437'));

      for (let i = 0; i < printItemsList.length; i++) {
        const item = printItemsList[i];
        await printerBridge.send(buildThermalLabel(labelOptionsFor(item.product)));
        setBtProgress({ current: i + 1, total: printItemsList.length });
        if (i < printItemsList.length - 1) {
          await new Promise(r => setTimeout(r, 150));
        }
      }
    } catch (err: any) {
      setBtError(err?.message || 'Print failed. Check printer connection.');
      if (!printerBridge.isConnected()) {
        setBtConnected(false);
        setPrinterName('');
      }
    } finally {
      setBtPrinting(false);
      setBtProgress({ current: 0, total: 0 });
    }
  }, [printItemsList, labelOptionsFor, btPrinting]);

  const handleTestPrint = useCallback(async () => {
    if (!printerBridge.isConnected() || btPrinting) return;
    setBtError(null);
    try {
      await printerBridge.send(testPrint());
    } catch (err: any) {
      setBtError(err?.message || 'Test print failed');
    }
  }, [btPrinting]);

  const handleFeedAlign = useCallback(async () => {
    if (!printerBridge.isConnected() || btPrinting) return;
    setBtError(null);
    try {
      await printerBridge.send(feedPitch(effLabelHeight, effLabelGap, effFeedOffset));
    } catch (err: any) {
      setBtError(err?.message || 'Feed failed');
    }
  }, [btPrinting, effLabelHeight, effLabelGap, effFeedOffset]);

  if (!isOpen) return null;

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const toggleSelectProduct = (id: string) => {
    setSelectedProducts(prev => {
      const copy = { ...prev };
      if (copy[id] !== undefined) {
        delete copy[id];
      } else {
        copy[id] = 1;
      }
      return copy;
    });
  };

  const setAllQuantities = (mode: 'one' | 'stock') => {
    const newMap: { [id: string]: number } = {};
    products.forEach(p => {
      newMap[p.id] = mode === 'stock' ? Math.max(1, p.stock) : 1;
    });
    setSelectedProducts(newMap);
  };

  const selectAll = () => {
    const newMap: { [id: string]: number } = {};
    products.forEach(p => {
      newMap[p.id] = selectedProducts[p.id] || 1;
    });
    setSelectedProducts(newMap);
  };

  const deselectAll = () => setSelectedProducts({});

  const updateQuantity = (id: string, qty: number) => {
    if (qty <= 0) {
      setSelectedProducts(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    } else {
      setSelectedProducts(prev => ({ ...prev, [id]: qty }));
    }
  };

  const totalLabels = printItemsList.length;

  const numInputClass = "w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-gray-900";
  const segBtn = (active: boolean) =>
    `flex-1 px-2 py-1.5 rounded-lg border font-bold text-[11px] transition-all text-center cursor-pointer ${
      active
        ? 'bg-gray-50 border-gray-900 text-gray-900 shadow-2xs'
        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs transition-opacity animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-black text-white rounded-xl shadow-xs">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                Barcode Label Generator
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Print sticker labels to a Bluetooth thermal printer
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {btAvailable && (
              <div className="flex items-center space-x-1.5 mr-1">
                {btConnected ? (
                  <>
                    <div className="flex items-center space-x-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-bold text-gray-900">
                      <CheckCircle2 className="w-3 h-3" />
                      <span className="max-w-[100px] truncate">{printerName}</span>
                    </div>
                    <button
                      onClick={handleDisconnectPrinter}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                      title="Disconnect printer"
                    >
                      <BluetoothOff className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    {isNative && pairedDevices.length > 0 && (
                      <select
                        value={selectedAddress}
                        onChange={(e) => setSelectedAddress(e.target.value)}
                        className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900 max-w-[140px] cursor-pointer"
                      >
                        {pairedDevices.map(d => (
                          <option key={d.address} value={d.address}>{d.name}</option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={handleConnectPrinter}
                      disabled={btConnecting}
                      className="px-2.5 py-1.5 bg-black hover:bg-gray-800 text-white font-bold text-[10px] rounded-lg shadow-xs transition-all flex items-center space-x-1 disabled:opacity-50 cursor-pointer"
                    >
                      {btConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bluetooth className="w-3 h-3" />}
                      <span>{btConnecting ? 'Connecting...' : 'Connect Printer'}</span>
                    </button>
                  </>
                )}
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">

          {/* LEFT PANEL */}
          <div className="lg:col-span-5 flex flex-col overflow-y-auto p-4 space-y-4 bg-slate-50/50">

             {/* LABEL SIZE (MM) */}
             <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
               <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                 <Ruler className="w-4 h-4 text-gray-900" />
                 <span>Label Size</span>
                 <span className="text-[10px] font-semibold text-slate-400">({printableMm}mm printable)</span>
               </div>

               {/* Paper mode: sticker vs receipt */}
               <div>
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                   Paper Type
                 </label>
                 <div className="flex gap-1.5 text-xs">
                   <button onClick={() => setPaperMode('sticker')} className={segBtn(paperMode === 'sticker')}>
                     <span className="inline-flex items-center justify-center gap-1"><Tag className="w-3 h-3" />Sticker Labels</span>
                   </button>
                   <button onClick={() => setPaperMode('receipt')} className={segBtn(paperMode === 'receipt')}>
                     <span className="inline-flex items-center justify-center gap-1"><Printer className="w-3 h-3" />Receipt Roll</span>
                   </button>
                 </div>
               </div>

               <div>
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                   Paper Width
                 </label>
                  <div className="flex gap-1.5 text-xs">
                    <button onClick={() => { setPaperWidth('32'); setLabelWidth('32'); setBarcodeWidth('32'); }} className={segBtn(paperWidth === '32')}>32mm</button>
                    <button onClick={() => { setPaperWidth('58'); setLabelWidth('58'); setBarcodeWidth('58'); }} className={segBtn(paperWidth === '58')}>58mm</button>
                    <button onClick={() => { setPaperWidth('80'); setLabelWidth('80'); setBarcodeWidth('80'); }} className={segBtn(paperWidth === '80')}>80mm</button>
                  </div>
               </div>

               <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                 <div>
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                     Label W (mm)
                   </label>
                   <input type="number" min={5} max={80} value={labelWidth}
                     onChange={e => setLabelWidth(e.target.value)} className={numInputClass} />
                 </div>
                 <div>
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                     Label H (mm)
                   </label>
                   <input type="number" min={8} max={300} value={labelHeight}
                     onChange={e => setLabelHeight(e.target.value)} className={numInputClass} />
                 </div>
                 <div>
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                     BC Box W (mm)
                   </label>
                   <input type="number" min={10} max={effLabelWidth} value={barcodeWidth}
                     onChange={e => setBarcodeWidth(e.target.value)} className={numInputClass} />
                 </div>
                 <div>
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                     BC Box H (mm)
                   </label>
                   <input type="number" min={3} max={effLabelHeight} value={barcodeHeight}
                     onChange={e => setBarcodeHeight(e.target.value)} className={numInputClass} />
                 </div>
               </div>

               {/* Sticker-only: gap + feed offset calibration */}
               {paperMode === 'sticker' && (
                 <div className="grid grid-cols-2 gap-2">
                   <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                       Label Gap (mm)
                     </label>
                     <input type="number" min={2} max={10} step={0.5} value={labelGap}
                       onChange={e => setLabelGap(e.target.value)} className={numInputClass} />
                   </div>
                   <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                       Feed Offset (mm)
                     </label>
                     <input type="number" min={-10} max={10} step={0.5} value={feedOffset}
                       onChange={e => setFeedOffset(e.target.value)} className={numInputClass} />
                   </div>
                 </div>
               )}

               <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                 {paperMode === 'sticker' ? (
                   <>Label: {effLabelWidth.toFixed(0)} × {effLabelHeight.toFixed(0)}mm · BC Box: {effBarcodeWidth.toFixed(0)} × {effBarcodeHeight.toFixed(0)}mm · gap {effLabelGap.toFixed(1)}mm · feed {effLabelHeight + effLabelGap + effFeedOffset > 0 ? (effLabelHeight + effLabelGap + effFeedOffset).toFixed(1) : '—'}mm total</>
                 ) : (
                   <>Label: {effLabelWidth.toFixed(0)} × {effLabelHeight.toFixed(0)}mm · BC Box: {effBarcodeWidth.toFixed(0)} × {effBarcodeHeight.toFixed(0)}mm</>
                 )}
                 {effLabelWidth > printableMm && <span className="text-gray-900 font-bold"> — printable width {printableMm}mm</span>}
               </p>

               {paperMode === 'sticker' && (
                 <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                   Set the height to match your sticker length (e.g. 25mm). Your printer has no label sensor, so before printing tap <strong>Feed</strong> (top-right) until the top edge of a sticker sits at the print head — this aligns every label.
                 </p>
               )}
             </div>

            {/* LABEL DESIGN */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Settings2 className="w-4 h-4 text-gray-900" />
                <span>Label Design</span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Store / Header Text
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={e => setStoreName(e.target.value)}
                  placeholder="Store or Branch Name"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-700">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={showStoreName} onChange={e => setShowStoreName(e.target.checked)} className="rounded text-gray-900 focus:ring-black/20" />
                  <span>Store Name</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={showProductName} onChange={e => setShowProductName(e.target.checked)} className="rounded text-gray-900 focus:ring-black/20" />
                  <span>Product Title</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={showPrice} onChange={e => setShowPrice(e.target.checked)} className="rounded text-gray-900 focus:ring-black/20" />
                  <span>Selling Price</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={showCodeText} onChange={e => setShowCodeText(e.target.checked)} className="rounded text-gray-900 focus:ring-black/20" />
                  <span>SKU / BC Text</span>
                </label>
              </div>

              {/* Custom X/Y positioning */}
              <div className="border border-slate-200 rounded-lg p-2.5 space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={customLayout} onChange={e => setCustomLayout(e.target.checked)} className="rounded text-gray-900 focus:ring-black/20" />
                  <span className="text-[11px] font-bold text-slate-800">Custom X/Y Position & Barcode Resizing</span>
                </label>
                {customLayout && (
                  <>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Drag elements directly on the preview card to position or resize them, or edit coordinates below. Barcode box fits strictly within paper edges.
                    </p>
                    <div className="grid grid-cols-[1fr_48px_48px_48px_48px] gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider items-center">
                      <span>Element</span><span>X mm</span><span>Y mm</span><span>W mm</span><span>H / Size</span>
                      
                      {/* Store */}
                      <span className="text-slate-700 normal-case font-semibold">Store</span>
                      <input type="number" step={0.5} min={0} max={Math.max(0, effLabelWidth - 5)} value={layoutXY.store.x}
                        onChange={e => setLayoutXY(prev => ({ ...prev, store: { ...prev.store, x: e.target.value } }))}
                        className="w-full px-1 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900" />
                      <input type="number" step={0.5} min={0} max={Math.max(0, effLabelHeight - 3)} value={layoutXY.store.y}
                        onChange={e => setLayoutXY(prev => ({ ...prev, store: { ...prev.store, y: e.target.value } }))}
                        className="w-full px-1 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900" />
                      <span className="text-[9px] text-slate-400 text-center">—</span>
                      <select value={fontSize.store} onChange={e => setFontSize(prev => ({ ...prev, store: Number(e.target.value) as 1 | 2 }))}
                        className="w-full px-1 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900 cursor-pointer">
                        <option value={1}>1x</option>
                        <option value={2}>2x</option>
                      </select>

                      {/* Product */}
                      <span className="text-slate-700 normal-case font-semibold">Product</span>
                      <input type="number" step={0.5} min={0} max={Math.max(0, effLabelWidth - 5)} value={layoutXY.product.x}
                        onChange={e => setLayoutXY(prev => ({ ...prev, product: { ...prev.product, x: e.target.value } }))}
                        className="w-full px-1 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900" />
                      <input type="number" step={0.5} min={0} max={Math.max(0, effLabelHeight - 3)} value={layoutXY.product.y}
                        onChange={e => setLayoutXY(prev => ({ ...prev, product: { ...prev.product, y: e.target.value } }))}
                        className="w-full px-1 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900" />
                      <span className="text-[9px] text-slate-400 text-center">—</span>
                      <select value={fontSize.product} onChange={e => setFontSize(prev => ({ ...prev, product: Number(e.target.value) as 1 | 2 }))}
                        className="w-full px-1 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900 cursor-pointer">
                        <option value={1}>1x</option>
                        <option value={2}>2x</option>
                      </select>

                      {/* Barcode Box */}
                      <span className="text-slate-900 normal-case font-extrabold">Barcode</span>
                      <input type="number" step={0.5} min={0} max={Math.max(0, effLabelWidth - effBarcodeWidth)} value={layoutXY.barcode.x}
                        onChange={e => setLayoutXY(prev => ({ ...prev, barcode: { ...prev.barcode, x: e.target.value } }))}
                        className="w-full px-1 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900" />
                      <input type="number" step={0.5} min={0} max={Math.max(0, effLabelHeight - effBarcodeHeight)} value={layoutXY.barcode.y}
                        onChange={e => setLayoutXY(prev => ({ ...prev, barcode: { ...prev.barcode, y: e.target.value } }))}
                        className="w-full px-1 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900" />
                      <input type="number" step={0.5} min={10} max={effLabelWidth} value={barcodeWidth}
                        onChange={e => setBarcodeWidth(e.target.value)}
                        className="w-full px-1 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900" />
                      <input type="number" step={0.5} min={3} max={effLabelHeight} value={barcodeHeight}
                        onChange={e => setBarcodeHeight(e.target.value)}
                        className="w-full px-1 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900" />

                      {/* Price */}
                      <span className="text-slate-700 normal-case font-semibold">Price</span>
                      <input type="number" step={0.5} min={0} max={Math.max(0, effLabelWidth - 5)} value={layoutXY.price.x}
                        onChange={e => setLayoutXY(prev => ({ ...prev, price: { ...prev.price, x: e.target.value } }))}
                        className="w-full px-1 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900" />
                      <input type="number" step={0.5} min={0} max={Math.max(0, effLabelHeight - 3)} value={layoutXY.price.y}
                        onChange={e => setLayoutXY(prev => ({ ...prev, price: { ...prev.price, y: e.target.value } }))}
                        className="w-full px-1 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900" />
                      <span className="text-[9px] text-slate-400 text-center">—</span>
                      <select value={fontSize.price} onChange={e => setFontSize(prev => ({ ...prev, price: Number(e.target.value) as 1 | 2 }))}
                        className="w-full px-1 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900 cursor-pointer">
                        <option value={1}>1x</option>
                        <option value={2}>2x</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                 <div>
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                     Barcode Format
                   </label>
                   <select
                     value={barcodeType}
                     onChange={e => setBarcodeType(e.target.value as BarcodeType)}
                     className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-gray-900 cursor-pointer"
                   >
                     {BARCODE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                   </select>
                 </div>
                 {paperMode === 'receipt' ? (
                   <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                       Cut Mode
                     </label>
                     <div className="flex gap-1.5 text-xs">
                       <button onClick={() => setCutMode('off')} className={segBtn(cutMode === 'off')}>
                         <span className="inline-flex items-center justify-center gap-1"><Scissors className="w-3 h-3" />Off</span>
                       </button>
                       <button onClick={() => setCutMode('partial')} className={segBtn(cutMode === 'partial')}>
                         <span className="inline-flex items-center justify-center gap-1"><Scissors className="w-3 h-3" />Partial</span>
                       </button>
                       <button onClick={() => setCutMode('full')} className={segBtn(cutMode === 'full')}>
                         <span className="inline-flex items-center justify-center gap-1"><Scissors className="w-3 h-3" />Full</span>
                       </button>
                     </div>
                   </div>
                 ) : (
                   <div className="flex items-end">
                     <p className="text-[10px] text-slate-400 font-medium">
                       Auto-feed: full label + gap
                     </p>
                   </div>
                 )}
               </div>
            </div>

            {/* PRODUCT SELECTION */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex-1 flex flex-col min-h-[280px]">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-extrabold text-slate-800">Select Products</span>
                <div className="flex items-center space-x-1.5 text-[10px]">
                  <button onClick={selectAll} className="text-gray-900 font-bold hover:underline cursor-pointer">All</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={deselectAll} className="text-slate-500 hover:underline cursor-pointer">None</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={() => setAllQuantities('stock')} className="text-slate-600 font-medium hover:underline cursor-pointer" title="Set label count equal to current inventory stock">Qty = Stock</button>
                </div>
              </div>

              <div className="relative mb-2">
                <Search className="absolute inset-y-0 left-0 pl-2.5 w-3.5 h-3.5 my-auto text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Filter by name, SKU, barcode..."
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-gray-900"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[260px] pr-1">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">No products found.</div>
                ) : (
                  filteredProducts.map(prod => {
                    const isSelected = selectedProducts[prod.id] !== undefined;
                    const qty = selectedProducts[prod.id] || 0;
                    const code = prod.barcode || prod.sku;
                    return (
                      <div
                        key={prod.id}
                        className={`p-2 rounded-lg border transition-all flex items-center justify-between text-xs ${
                          isSelected ? 'bg-gray-50/50 border-gray-200' : 'bg-white border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                          <button onClick={() => toggleSelectProduct(prod.id)} className="text-gray-900 shrink-0 cursor-pointer">
                            {isSelected ? <CheckSquare className="w-4 h-4 text-gray-900" /> : <Square className="w-4 h-4 text-slate-300" />}
                          </button>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate text-[11px]">{prod.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              {code} • <span className="font-semibold text-slate-700">{prod.price.toLocaleString()} {currencySymbol}</span>
                            </p>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="flex items-center space-x-1 shrink-0 bg-white border border-slate-200 rounded-md p-0.5 shadow-2xs">
                            <button onClick={() => updateQuantity(prod.id, qty - 1)} className="w-5 h-5 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded font-bold cursor-pointer">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center font-bold text-xs font-mono">{qty}</span>
                            <button onClick={() => updateQuantity(prod.id, qty + 1)} className="w-5 h-5 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded font-bold cursor-pointer">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: LIVE PREVIEW */}
          <div className="lg:col-span-7 flex flex-col overflow-hidden bg-slate-100/70 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-gray-900" />
                <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                  Preview ({totalLabels} labels · {effLabelWidth.toFixed(0)}×{effLabelHeight.toFixed(0)}mm)
                </span>
              </div>

              {btAvailable && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleTestPrint}
                    disabled={!btConnected || btPrinting}
                    className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                    title="Print a plain test receipt (no barcode/cut) to verify the connection"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Test Print</span>
                  </button>
                  <button
                    onClick={handleFeedAlign}
                    disabled={!btConnected || btPrinting}
                    className="px-3 py-1.5 bg-slate-400 hover:bg-slate-500 text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                    title="Advance paper by one sticker so you can align the top of a label at the print head"
                  >
                    <Ruler className="w-3.5 h-3.5" />
                    <span>Feed</span>
                  </button>
                  <button
                    onClick={handleBtPrint}
                    disabled={totalLabels === 0 || !btConnected || btPrinting}
                    className="px-3 py-1.5 bg-black hover:bg-gray-800 text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {btPrinting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bluetooth className="w-3.5 h-3.5" />}
                    <span>{btPrinting ? `${btProgress.current}/${btProgress.total}` : 'BT Print'}</span>
                  </button>
                </div>
              )}
            </div>

            {btError && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{btError}</span>
                <button onClick={() => setBtError(null)} className="text-red-400 hover:text-red-600 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto bg-slate-200/50 p-4 rounded-xl border border-slate-300 shadow-inner">
              {totalLabels === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs">
                  <Printer className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold text-slate-600">No products selected.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Check the product boxes on the left to add barcode labels.</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3 justify-center items-start">
                  {printItemsList.map((item, idx) => {
                    const codeVal = normalizeBarcodeValue(item.product.barcode || item.product.sku || '000000', barcodeType);
                    if (customLayout) {
                      const bcW = Math.max(12, effBarcodeWidth * previewScale);
                      const bcH = Math.max(12, effBarcodeHeight * previewScale);
                      const bcX = effBarcodeX * previewScale;
                      const bcY = effBarcodeY * previewScale;

                      return (
                        <div
                          key={idx}
                          className="bg-white border border-slate-400 rounded shadow-xs select-none overflow-hidden touch-none relative"
                          style={{ width: previewW, height: previewH }}
                        >
                          {showStoreName && (
                            <div
                              className="absolute font-extrabold uppercase text-slate-700 truncate cursor-move hover:ring-1 hover:ring-slate-400 p-0.5 rounded"
                              style={{
                                left: effLayoutX('store') * previewScale,
                                top: effLayoutY('store') * previewScale,
                                width: Math.max(10, (effLabelWidth - effLayoutX('store')) * previewScale),
                                fontSize: 8 * fontSize.store,
                              }}
                              onPointerDown={(e) => handlePointerDown(e, 'move-store')}
                              onPointerMove={handlePointerMove}
                              onPointerUp={handlePointerUp}
                            >
                              {storeName}
                            </div>
                          )}

                          {showProductName && (
                            <p
                              className="absolute font-extrabold text-slate-900 leading-tight truncate cursor-move hover:ring-1 hover:ring-slate-400 p-0.5 rounded"
                              style={{
                                left: effLayoutX('product') * previewScale,
                                top: effLayoutY('product') * previewScale,
                                width: Math.max(10, (effLabelWidth - effLayoutX('product')) * previewScale),
                                fontSize: 8 * fontSize.product,
                              }}
                              onPointerDown={(e) => handlePointerDown(e, 'move-product')}
                              onPointerMove={handlePointerMove}
                              onPointerUp={handlePointerUp}
                            >
                              {item.product.name}
                            </p>
                          )}

                          {/* BARCODE BOX WITH DRAG & RESIZE HANDLES */}
                          <div
                            className="absolute border border-dashed border-slate-900 bg-slate-900/5 group flex flex-col items-center justify-between rounded cursor-move select-none p-0.5"
                            style={{ left: bcX, top: bcY, width: bcW, height: bcH }}
                            onPointerDown={(e) => handlePointerDown(e, 'move-barcode')}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            title={`Drag box to move, handles to resize (${effBarcodeWidth.toFixed(1)}×${effBarcodeHeight.toFixed(1)}mm)`}
                          >
                            <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden pointer-events-none">
                              <BarcodeSVG value={codeVal} height={Math.max(8, bcH - (showCodeText ? 10 : 2))} showValue={false} />
                              {showCodeText && (
                                <div className="font-mono font-bold text-slate-900 text-center truncate w-full" style={{ fontSize: Math.max(6, Math.min(10, bcH * 0.25)) }}>
                                  {codeVal}
                                </div>
                              )}
                            </div>

                            {/* Resize Handle: East (Width) */}
                            <div
                              className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-4 bg-slate-900 border border-white rounded-2xs cursor-ew-resize opacity-80 hover:opacity-100 z-10"
                              title="Resize Barcode Width"
                              onPointerDown={(e) => handlePointerDown(e, 'resize-barcode-e')}
                              onPointerMove={handlePointerMove}
                              onPointerUp={handlePointerUp}
                            />
                            {/* Resize Handle: South (Height) */}
                            <div
                              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-2 bg-slate-900 border border-white rounded-2xs cursor-ns-resize opacity-80 hover:opacity-100 z-10"
                              title="Resize Barcode Height"
                              onPointerDown={(e) => handlePointerDown(e, 'resize-barcode-s')}
                              onPointerMove={handlePointerMove}
                              onPointerUp={handlePointerUp}
                            />
                            {/* Resize Handle: South-East (Width & Height) */}
                            <div
                              className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-black border border-white rounded-2xs cursor-nwse-resize opacity-90 hover:opacity-100 z-10"
                              title="Resize Barcode Box"
                              onPointerDown={(e) => handlePointerDown(e, 'resize-barcode-se')}
                              onPointerMove={handlePointerMove}
                              onPointerUp={handlePointerUp}
                            />
                          </div>

                          {showPrice && (
                            <div
                              className="absolute bg-slate-900 text-white rounded flex items-center justify-center cursor-move p-0.5"
                              style={{
                                left: effLayoutX('price') * previewScale,
                                top: effLayoutY('price') * previewScale,
                                width: Math.max(12, (effLabelWidth - effLayoutX('price')) * previewScale),
                                fontSize: Math.max(7, 4 * fontSize.price),
                              }}
                              onPointerDown={(e) => handlePointerDown(e, 'move-price')}
                              onPointerMove={handlePointerMove}
                              onPointerUp={handlePointerUp}
                            >
                              <span className="font-extrabold font-mono px-1 truncate">
                                {item.product.price.toLocaleString()} {currencySymbol}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div
                        key={idx}
                        className="bg-white border border-slate-400 rounded shadow-xs flex flex-col items-center justify-center text-center select-none overflow-hidden p-1.5"
                        style={{ width: previewW, height: previewH }}
                      >
                        {showStoreName && (
                          <span className="text-[7px] font-extrabold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-0.5 w-full truncate">
                            {storeName}
                          </span>
                        )}
                        {showProductName && (
                          <p className="font-extrabold text-[8px] text-slate-900 leading-tight line-clamp-2 w-full px-0.5 my-0.5">
                            {item.product.name}
                          </p>
                        )}
                        <div className="my-0.5 px-0.5 flex items-center justify-center overflow-hidden" style={{ width: effBarcodeWidth * previewScale, height: effBarcodeHeight * previewScale }}>
                          <BarcodeSVG value={codeVal} height={Math.max(10, effBarcodeHeight * previewScale - (showCodeText ? 10 : 0))} showValue={showCodeText} />
                        </div>
                        {showPrice && (
                          <div className="w-full flex items-center justify-center bg-slate-900 text-white rounded py-0.5 px-1 mt-0.5">
                            <span className="font-extrabold font-mono text-[8px] leading-none">
                              {item.product.price.toLocaleString()} {currencySymbol}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
          <span className="text-slate-500 font-medium">
            Total Labels: <strong className="text-slate-900 font-bold">{totalLabels}</strong>
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {btAvailable && (
              <button
                onClick={handleBtPrint}
                disabled={totalLabels === 0 || !btConnected || btPrinting}
                className="px-5 py-2 bg-black hover:bg-gray-800 text-white font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                {btPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                <span>
                  {btPrinting ? `Printing ${btProgress.current}/${btProgress.total}` : `Print ${totalLabels} Labels`}
                </span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default BarcodePrintModal;
