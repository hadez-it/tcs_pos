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
  buildThermalLabel, init as escInit, setCodePage,
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
  const [paperWidth, setPaperWidth] = useState<'32' | '58' | '80'>('32');
  const [labelWidth, setLabelWidth] = useState('32');
  const [labelHeight, setLabelHeight] = useState('25');
  const [barcodeHeight, setBarcodeHeight] = useState('10');
  const [barcodeType, setBarcodeType] = useState<BarcodeType>('CODE39');
  const [cutMode, setCutMode] = useState<'off' | 'full' | 'partial'>('off');
  const [labelGap, setLabelGap] = useState('3');
  const [feedOffset, setFeedOffset] = useState('0');

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
  const effBarcodeHeight = clamp(parseMm(barcodeHeight) || 10, 3, Math.min(effLabelHeight * 0.8, 40));
  const effLabelGap = clamp(parseMm(labelGap) || 3, 2, 10);
  const effFeedOffset = clamp(parseMm(feedOffset) || 0, -10, 10);

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
    barcodeHeightMm: effBarcodeHeight,
    cutMode: paperMode === 'sticker' ? 'off' : cutMode,
    paperMode,
    labelGapMm: effLabelGap,
    feedOffsetMm: effFeedOffset,
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

  const numInputClass = "w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500";
  const segBtn = (active: boolean) =>
    `flex-1 px-2 py-1.5 rounded-lg border font-bold text-[11px] transition-all text-center cursor-pointer ${
      active
        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs'
        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
    }`;

  const previewScale = Math.min(240 / effLabelWidth, 5);
  const previewW = Math.round(effLabelWidth * previewScale);
  const previewH = Math.round(effLabelHeight * previewScale);

  return (
    <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs transition-opacity animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
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
                    <div className="flex items-center space-x-1 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] font-bold text-emerald-700">
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
                        className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-blue-500 max-w-[140px] cursor-pointer"
                      >
                        {pairedDevices.map(d => (
                          <option key={d.address} value={d.address}>{d.name}</option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={handleConnectPrinter}
                      disabled={btConnecting}
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded-lg shadow-xs transition-all flex items-center space-x-1 disabled:opacity-50 cursor-pointer"
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
                 <Ruler className="w-4 h-4 text-indigo-600" />
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
                   <button onClick={() => setPaperWidth('32')} className={segBtn(paperWidth === '32')}>32mm</button>
                   <button onClick={() => setPaperWidth('58')} className={segBtn(paperWidth === '58')}>58mm</button>
                   <button onClick={() => setPaperWidth('80')} className={segBtn(paperWidth === '80')}>80mm</button>
                 </div>
               </div>

               <div className="grid grid-cols-3 gap-2">
                 <div>
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                     Width (mm)
                   </label>
                   <input type="number" min={5} max={80} value={labelWidth}
                     onChange={e => setLabelWidth(e.target.value)} className={numInputClass} />
                 </div>
                 <div>
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                     Height (mm)
                   </label>
                   <input type="number" min={8} max={300} value={labelHeight}
                     onChange={e => setLabelHeight(e.target.value)} className={numInputClass} />
                 </div>
                 <div>
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                     Barcode H (mm)
                   </label>
                   <input type="number" min={3} max={40} value={barcodeHeight}
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
                   <>Label: {effLabelWidth.toFixed(0)} × {effLabelHeight.toFixed(0)}mm · gap {effLabelGap.toFixed(1)}mm · feed {effLabelHeight + effLabelGap + effFeedOffset > 0 ? (effLabelHeight + effLabelGap + effFeedOffset).toFixed(1) : '—'}mm total</>
                 ) : (
                   <>Label: {effLabelWidth.toFixed(0)} × {effLabelHeight.toFixed(0)}mm</>
                 )}
                 {effLabelWidth > printableMm && <span className="text-amber-600 font-bold"> — printable width {printableMm}mm</span>}
               </p>

               {paperMode === 'sticker' && (
                 <p className="text-[10px] text-indigo-500 font-medium leading-relaxed">
                   Set the height to match your sticker length (e.g. 30mm). The printer feeds one full label + gap so the next sticker is ready at the print head.
                 </p>
               )}
             </div>

            {/* LABEL DESIGN */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Settings2 className="w-4 h-4 text-indigo-600" />
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
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-700">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={showStoreName} onChange={e => setShowStoreName(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span>Store Name</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={showProductName} onChange={e => setShowProductName(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span>Product Title</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={showPrice} onChange={e => setShowPrice(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span>Selling Price</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={showCodeText} onChange={e => setShowCodeText(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span>SKU / BC Text</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                 <div>
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                     Barcode Format
                   </label>
                   <select
                     value={barcodeType}
                     onChange={e => setBarcodeType(e.target.value as BarcodeType)}
                     className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
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
                  <button onClick={selectAll} className="text-indigo-600 font-bold hover:underline cursor-pointer">All</button>
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
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
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
                          isSelected ? 'bg-indigo-50/50 border-indigo-200' : 'bg-white border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                          <button onClick={() => toggleSelectProduct(prod.id)} className="text-indigo-600 shrink-0 cursor-pointer">
                            {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4 text-slate-300" />}
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
                <Tag className="w-4 h-4 text-indigo-600" />
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
                    onClick={handleBtPrint}
                    disabled={totalLabels === 0 || !btConnected || btPrinting}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
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
                        <div className="w-full my-0.5 px-0.5">
                          <BarcodeSVG value={codeVal} height={Math.max(12, previewH * 0.35)} showValue={showCodeText} />
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
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
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
