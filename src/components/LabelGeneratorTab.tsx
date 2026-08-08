import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer, X, Search, CheckSquare, Square, Settings2,
  Tag, Bluetooth, BluetoothOff, Loader2, CheckCircle2, AlertCircle,
  Minus, Plus, Ruler, Scissors, RefreshCw, Save, Layers,
} from 'lucide-react';
import { Product, LabelConfig } from '../types';
import BarcodeSVG from './BarcodeSVG';
import * as printerBridge from '../lib/printerBridge';
import {
  buildThermalLabel, init as escInit, setCodePage, feedPitch,
  BarcodeType, normalizeBarcodeValue, getPrintableMm, testPrint,
} from '../lib/escpos';
import { loadLabelConfig, saveLabelConfig, DEFAULT_LABEL_CONFIG } from '../lib/labelConfig';

interface LabelGeneratorTabProps {
  products: Product[];
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

export const LabelGeneratorTab: React.FC<LabelGeneratorTabProps> = ({
  products,
  currencySymbol = 'Ks',
  businessName,
}) => {
  const [config, setConfig] = useState<LabelConfig>(() => loadLabelConfig(businessName));
  const [saveToast, setSaveToast] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sampleProductId, setSampleProductId] = useState<string>(() => (products[0] ? products[0].id : ''));

  const [selectedProducts, setSelectedProducts] = useState<{ [id: string]: number }>({});

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

  useEffect(() => {
    const last = printerBridge.getLastPrinter();
    if (last?.address) {
      setSelectedAddress(last.address);
    }

    if (isNative) {
      printerBridge.getPairedPrinters().then(devs => {
        setPairedDevices(devs);
        if (devs.length > 0 && !last?.address) {
          setSelectedAddress(devs[0].address);
        }
      }).catch(() => {});

      if (!printerBridge.isConnected()) {
        printerBridge.autoConnectLastPrinter().then(name => {
          if (name) {
            setBtConnected(true);
            setPrinterName(name);
          }
        }).catch(() => {});
      }
    }

    printerBridge.onDisconnect(() => {
      setBtConnected(false);
      setPrinterName('');
    });
    return () => {
      printerBridge.offDisconnect();
    };
  }, [isNative]);

  const updateConfig = (updater: (prev: LabelConfig) => LabelConfig) => {
    setConfig(prev => {
      const next = updater(prev);
      saveLabelConfig(next);
      return next;
    });
  };

  const handleSaveSettings = () => {
    saveLabelConfig(config);
    if (selectedAddress) {
      const dev = pairedDevices.find(d => d.address === selectedAddress);
      printerBridge.saveLastPrinter(selectedAddress, dev?.name || printerName || selectedAddress);
    }
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  };

  const handleResetDefaults = () => {
    const fresh = {
      ...DEFAULT_LABEL_CONFIG,
      storeName: businessName || DEFAULT_LABEL_CONFIG.storeName,
    };
    setConfig(fresh);
    saveLabelConfig(fresh);
  };

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
      if (err?.name !== 'NotFoundError') {
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

  const effPaperWidth = config.paperWidth === '80' ? 80 : config.paperWidth === '58' ? 58 : 32;
  const printableMm = getPrintableMm(effPaperWidth);
  const effLabelWidth = clamp(parseMm(config.labelWidth) || effPaperWidth, 5, 80);
  const effLabelHeight = clamp(parseMm(config.labelHeight) || 30, 8, 300);

  const rawBcW = parseMm(config.barcodeWidth) || effLabelWidth;
  const effBarcodeWidth = clamp(rawBcW, 10, effLabelWidth);

  const rawBcH = parseMm(config.barcodeHeight) || 10;
  const effBarcodeHeight = clamp(rawBcH, 3, effLabelHeight);

  const rawBcX = parseMm(config.layoutXY.barcode.x) || 0;
  const effBarcodeX = clamp(rawBcX, 0, Math.max(0, effLabelWidth - effBarcodeWidth));

  const rawBcY = parseMm(config.layoutXY.barcode.y) || 0;
  const effBarcodeY = clamp(rawBcY, 0, Math.max(0, effLabelHeight - effBarcodeHeight));

  const effLabelGap = clamp(parseMm(config.labelGap) || 3, 2, 10);
  const effFeedOffset = clamp(parseMm(config.feedOffset) || 0, -10, 10);

  const effLayoutX = (k: 'store' | 'product' | 'price') => clamp(parseMm(config.layoutXY[k].x) || 0, 0, Math.max(0, effLabelWidth - 5));
  const effLayoutY = (k: 'store' | 'product' | 'price') => clamp(parseMm(config.layoutXY[k].y) || 0, 0, Math.max(0, effLabelHeight - 3));

  const previewScale = Math.min(320 / effLabelWidth, 6);
  const previewW = Math.round(effLabelWidth * previewScale);
  const previewH = Math.round(effLabelHeight * previewScale);

  const sampleProduct: Product = products.find(p => p.id === sampleProductId) || products[0] || {
    id: 'sample',
    name: 'Sample Product Item',
    sku: 'SAMPLE-101',
    barcode: '885001234567',
    price: 15000,
    cost: 10000,
    stock: 25,
    min_stock_level: 5,
    category: 'General',
    created_at: new Date().toISOString(),
  };

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
      updateConfig(prev => ({
        ...prev,
        layoutXY: { ...prev.layoutXY, barcode: { x: newX.toFixed(1), y: newY.toFixed(1) } }
      }));
    } else if (dragState.type === 'resize-barcode-e') {
      const maxW = Math.max(10, effLabelWidth - effBarcodeX);
      const newW = clamp(dragState.initialW + dxMm, 10, maxW);
      updateConfig(prev => ({ ...prev, barcodeWidth: newW.toFixed(1) }));
    } else if (dragState.type === 'resize-barcode-s') {
      const maxH = Math.max(3, effLabelHeight - effBarcodeY);
      const newH = clamp(dragState.initialH + dyMm, 3, maxH);
      updateConfig(prev => ({ ...prev, barcodeHeight: newH.toFixed(1) }));
    } else if (dragState.type === 'resize-barcode-se') {
      const maxW = Math.max(10, effLabelWidth - effBarcodeX);
      const maxH = Math.max(3, effLabelHeight - effBarcodeY);
      const newW = clamp(dragState.initialW + dxMm, 10, maxW);
      const newH = clamp(dragState.initialH + dyMm, 3, maxH);
      updateConfig(prev => ({ ...prev, barcodeWidth: newW.toFixed(1), barcodeHeight: newH.toFixed(1) }));
    } else if (dragState.type === 'move-store') {
      const newX = clamp(dragState.initialStoreX + dxMm, 0, Math.max(0, effLabelWidth - 5));
      const newY = clamp(dragState.initialStoreY + dyMm, 0, Math.max(0, effLabelHeight - 3));
      updateConfig(prev => ({ ...prev, layoutXY: { ...prev.layoutXY, store: { x: newX.toFixed(1), y: newY.toFixed(1) } } }));
    } else if (dragState.type === 'move-product') {
      const newX = clamp(dragState.initialProdX + dxMm, 0, Math.max(0, effLabelWidth - 5));
      const newY = clamp(dragState.initialProdY + dyMm, 0, Math.max(0, effLabelHeight - 3));
      updateConfig(prev => ({ ...prev, layoutXY: { ...prev.layoutXY, product: { x: newX.toFixed(1), y: newY.toFixed(1) } } }));
    } else if (dragState.type === 'move-price') {
      const newX = clamp(dragState.initialPriceX + dxMm, 0, Math.max(0, effLabelWidth - 5));
      const newY = clamp(dragState.initialPriceY + dyMm, 0, Math.max(0, effLabelHeight - 3));
      updateConfig(prev => ({ ...prev, layoutXY: { ...prev.layoutXY, price: { x: newX.toFixed(1), y: newY.toFixed(1) } } }));
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

  const layoutForPrint = config.customLayout
    ? {
        storeName: config.showStoreName ? { xMm: effLayoutX('store'), yMm: effLayoutY('store'), size: config.fontSize.store } : undefined,
        productName: config.showProductName ? { xMm: effLayoutX('product'), yMm: effLayoutY('product'), size: config.fontSize.product } : undefined,
        barcode: { xMm: effBarcodeX, yMm: effBarcodeY, widthMm: effBarcodeWidth, heightMm: effBarcodeHeight },
        price: config.showPrice ? { xMm: effLayoutX('price'), yMm: effLayoutY('price'), size: config.fontSize.price } : undefined,
      }
    : undefined;

  const labelOptionsFor = (productItem: Product) => ({
    storeName: config.storeName || businessName || 'My Retail Store',
    productName: productItem.name,
    barcodeValue: productItem.barcode || productItem.sku || '000000',
    price: productItem.price,
    showStoreName: config.showStoreName,
    showProductName: config.showProductName,
    showPrice: config.showPrice,
    showBarcodeText: config.showCodeText,
    currencySymbol,
    paperWidthMm: effPaperWidth,
    labelWidthMm: effLabelWidth,
    labelHeightMm: effLabelHeight,
    barcodeType: config.barcodeType as BarcodeType,
    barcodeWidthMm: effBarcodeWidth,
    barcodeHeightMm: effBarcodeHeight,
    cutMode: config.paperMode === 'sticker' ? ('off' as const) : config.cutMode,
    paperMode: config.paperMode,
    labelGapMm: effLabelGap,
    feedOffsetMm: effFeedOffset,
    layout: layoutForPrint,
  });

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

  const handleBtPrintBulk = useCallback(async () => {
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

  const numInputClass = "w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-gray-900";
  const segBtn = (active: boolean) =>
    `flex-1 px-2.5 py-1.5 rounded-lg border font-bold text-xs transition-all text-center cursor-pointer ${
      active
        ? 'bg-black text-white border-black shadow-xs'
        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
    }`;

  const sampleCodeVal = normalizeBarcodeValue(sampleProduct.barcode || sampleProduct.sku || '000000', config.barcodeType as BarcodeType);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      
      {/* Top Banner & Header */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-black text-white rounded-xl shadow-xs shrink-0">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
              Label Generator & Thermal Layout Designer
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Choose Bluetooth printer models, calibrate sticker paper sizes, and edit item label positions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleResetDefaults}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            title="Reset layout to standard defaults"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={handleSaveSettings}
            className="px-4 py-2 bg-black hover:bg-gray-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            title="Save printer and label layout settings to local storage"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      {saveToast && (
        <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center space-x-2 text-xs text-gray-900 font-bold shadow-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-gray-900 shrink-0" />
          <span>Printer and label layout settings saved successfully!</span>
        </div>
      )}

      {btError && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{btError}</span>
          <button onClick={() => setBtError(null)} className="text-red-400 hover:text-red-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Printer & Layout Config vs Live Preview & Bulk Print */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Printer Model, Paper Size, Layout Controls */}
        <div className="lg:col-span-6 space-y-6">

          {/* Card 1: Printer Model & Connection */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bluetooth className="w-5 h-5 text-gray-900" />
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Printer Model & Connection
                </h3>
              </div>

              {btConnected && (
                <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-900">
                  <CheckCircle2 className="w-3.5 h-3.5 text-gray-900" />
                  <span className="truncate max-w-[140px]">{printerName}</span>
                </div>
              )}
            </div>

            {btAvailable ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {isNative && pairedDevices.length > 0 && !btConnected && (
                    <select
                      value={selectedAddress}
                      onChange={(e) => setSelectedAddress(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-gray-900 cursor-pointer"
                    >
                      {pairedDevices.map(d => (
                        <option key={d.address} value={d.address}>{d.name} ({d.address})</option>
                      ))}
                    </select>
                  )}

                  {btConnected ? (
                    <button
                      onClick={handleDisconnectPrinter}
                      className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
                    >
                      <BluetoothOff className="w-4 h-4" />
                      <span>Disconnect Printer</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectPrinter}
                      disabled={btConnecting}
                      className="flex-1 px-4 py-2 bg-black hover:bg-gray-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {btConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bluetooth className="w-4 h-4" />}
                      <span>{btConnecting ? 'Connecting Printer...' : 'Connect Thermal Printer'}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <button
                    onClick={handleTestPrint}
                    disabled={!btConnected || btPrinting}
                    className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>Test Print</span>
                  </button>
                  <button
                    onClick={handleFeedAlign}
                    disabled={!btConnected || btPrinting}
                    className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <Ruler className="w-3.5 h-3.5 text-slate-600" />
                    <span>Feed & Align Sticker</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 font-medium">
                Web Bluetooth is not supported on this browser. On Android devices, open the native app to connect Bluetooth thermal printers.
              </p>
            )}
          </div>

          {/* Card 2: Paper Size & Thermal Dimensions */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Ruler className="w-5 h-5 text-gray-900" />
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Paper Size & Label Dimensions
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                ({printableMm}mm printable)
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Paper Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateConfig(p => ({ ...p, paperMode: 'sticker' }))}
                    className={segBtn(config.paperMode === 'sticker')}
                  >
                    <span className="inline-flex items-center justify-center gap-1.5"><Tag className="w-3.5 h-3.5" />Sticker Labels</span>
                  </button>
                  <button
                    onClick={() => updateConfig(p => ({ ...p, paperMode: 'receipt' }))}
                    className={segBtn(config.paperMode === 'receipt')}
                  >
                    <span className="inline-flex items-center justify-center gap-1.5"><Printer className="w-3.5 h-3.5" />Continuous Roll</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Roll / Paper Width
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateConfig(p => ({ ...p, paperWidth: '32', labelWidth: '32', barcodeWidth: '32' }))}
                    className={segBtn(config.paperWidth === '32')}
                  >
                    32mm
                  </button>
                  <button
                    onClick={() => updateConfig(p => ({ ...p, paperWidth: '58', labelWidth: '58', barcodeWidth: '58' }))}
                    className={segBtn(config.paperWidth === '58')}
                  >
                    58mm
                  </button>
                  <button
                    onClick={() => updateConfig(p => ({ ...p, paperWidth: '80', labelWidth: '80', barcodeWidth: '80' }))}
                    className={segBtn(config.paperWidth === '80')}
                  >
                    80mm
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Label W (mm)
                  </label>
                  <input
                    type="number" min={5} max={80} value={config.labelWidth}
                    onChange={e => updateConfig(p => ({ ...p, labelWidth: e.target.value }))}
                    className={numInputClass}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Label H (mm)
                  </label>
                  <input
                    type="number" min={8} max={300} value={config.labelHeight}
                    onChange={e => updateConfig(p => ({ ...p, labelHeight: e.target.value }))}
                    className={numInputClass}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    BC Box W (mm)
                  </label>
                  <input
                    type="number" min={10} max={effLabelWidth} value={config.barcodeWidth}
                    onChange={e => updateConfig(p => ({ ...p, barcodeWidth: e.target.value }))}
                    className={numInputClass}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    BC Box H (mm)
                  </label>
                  <input
                    type="number" min={3} max={effLabelHeight} value={config.barcodeHeight}
                    onChange={e => updateConfig(p => ({ ...p, barcodeHeight: e.target.value }))}
                    className={numInputClass}
                  />
                </div>
              </div>

              {config.paperMode === 'sticker' && (
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Label Gap (mm)
                    </label>
                    <input
                      type="number" min={2} max={10} step={0.5} value={config.labelGap}
                      onChange={e => updateConfig(p => ({ ...p, labelGap: e.target.value }))}
                      className={numInputClass}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Feed Offset (mm)
                    </label>
                    <input
                      type="number" min={-10} max={10} step={0.5} value={config.feedOffset}
                      onChange={e => updateConfig(p => ({ ...p, feedOffset: e.target.value }))}
                      className={numInputClass}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Label Fields & X/Y Layout Controls */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center space-x-2">
              <Settings2 className="w-5 h-5 text-gray-900" />
              <h3 className="font-extrabold text-slate-900 text-sm">
                Label Layout & Fields Settings
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Store / Header Name
                </label>
                <input
                  type="text"
                  value={config.storeName}
                  onChange={e => updateConfig(p => ({ ...p, storeName: e.target.value }))}
                  placeholder="Store or Branch Name"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
                <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                  <input
                    type="checkbox"
                    checked={config.showStoreName}
                    onChange={e => updateConfig(p => ({ ...p, showStoreName: e.target.checked }))}
                    className="rounded text-gray-900 focus:ring-black/20"
                  />
                  <span>Store Name</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                  <input
                    type="checkbox"
                    checked={config.showProductName}
                    onChange={e => updateConfig(p => ({ ...p, showProductName: e.target.checked }))}
                    className="rounded text-gray-900 focus:ring-black/20"
                  />
                  <span>Product Title</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                  <input
                    type="checkbox"
                    checked={config.showPrice}
                    onChange={e => updateConfig(p => ({ ...p, showPrice: e.target.checked }))}
                    className="rounded text-gray-900 focus:ring-black/20"
                  />
                  <span>Selling Price</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                  <input
                    type="checkbox"
                    checked={config.showCodeText}
                    onChange={e => updateConfig(p => ({ ...p, showCodeText: e.target.checked }))}
                    className="rounded text-gray-900 focus:ring-black/20"
                  />
                  <span>SKU / BC Text</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Barcode Format
                  </label>
                  <select
                    value={config.barcodeType}
                    onChange={e => updateConfig(p => ({ ...p, barcodeType: e.target.value as BarcodeType }))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-gray-900 cursor-pointer"
                  >
                    {BARCODE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                {config.paperMode === 'receipt' && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Paper Cut Mode
                    </label>
                    <div className="flex gap-1 text-xs">
                      <button onClick={() => updateConfig(p => ({ ...p, cutMode: 'off' }))} className={segBtn(config.cutMode === 'off')}>
                        Off
                      </button>
                      <button onClick={() => updateConfig(p => ({ ...p, cutMode: 'partial' }))} className={segBtn(config.cutMode === 'partial')}>
                        Partial
                      </button>
                      <button onClick={() => updateConfig(p => ({ ...p, cutMode: 'full' }))} className={segBtn(config.cutMode === 'full')}>
                        Full
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Custom X/Y Position & Barcode Box Controls */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.customLayout}
                    onChange={e => updateConfig(p => ({ ...p, customLayout: e.target.checked }))}
                    className="rounded text-gray-900 focus:ring-black/20"
                  />
                  <span className="text-xs font-bold text-slate-900">Custom X/Y Position & Box Resizing</span>
                </label>

                {config.customLayout && (
                  <div className="pt-2 space-y-2">
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                      Drag elements directly on the preview card, or specify precise millimetre coordinates below.
                    </p>
                    
                    <div className="grid grid-cols-[1fr_48px_48px_48px_48px] gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider items-center">
                      <span>Element</span><span>X mm</span><span>Y mm</span><span>W mm</span><span>Size</span>
                      
                      {/* Store */}
                      <span className="text-slate-800 normal-case font-bold">Store</span>
                      <input type="number" step={0.5} min={0} max={Math.max(0, effLabelWidth - 5)} value={config.layoutXY.store.x}
                        onChange={e => updateConfig(p => ({ ...p, layoutXY: { ...p.layoutXY, store: { ...p.layoutXY.store, x: e.target.value } } }))}
                        className="w-full px-1 py-1 bg-white border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900" />
                      <input type="number" step={0.5} min={0} max={Math.max(0, effLabelHeight - 3)} value={config.layoutXY.store.y}
                        onChange={e => updateConfig(p => ({ ...p, layoutXY: { ...p.layoutXY, store: { ...p.layoutXY.store, y: e.target.value } } }))}
                        className="w-full px-1 py-1 bg-white border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900" />
                      <span className="text-[9px] text-slate-400 text-center">—</span>
                      <select value={config.fontSize.store} onChange={e => updateConfig(p => ({ ...p, fontSize: { ...p.fontSize, store: Number(e.target.value) as 1 | 2 } }))}
                        className="w-full px-1 py-1 bg-white border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900 cursor-pointer">
                        <option value={1}>1x</option>
                        <option value={2}>2x</option>
                      </select>

                      {/* Product */}
                      <span className="text-slate-800 normal-case font-bold">Product</span>
                      <input type="number" step={0.5} min={0} max={Math.max(0, effLabelWidth - 5)} value={config.layoutXY.product.x}
                        onChange={e => updateConfig(p => ({ ...p, layoutXY: { ...p.layoutXY, product: { ...p.layoutXY.product, x: e.target.value } } }))}
                        className="w-full px-1 py-1 bg-white border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900" />
                      <input type="number" step={0.5} min={0} max={Math.max(0, effLabelHeight - 3)} value={config.layoutXY.product.y}
                        onChange={e => updateConfig(p => ({ ...p, layoutXY: { ...p.layoutXY, product: { ...p.layoutXY.product, y: e.target.value } } }))}
                        className="w-full px-1 py-1 bg-white border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900" />
                      <span className="text-[9px] text-slate-400 text-center">—</span>
                      <select value={config.fontSize.product} onChange={e => updateConfig(p => ({ ...p, fontSize: { ...p.fontSize, product: Number(e.target.value) as 1 | 2 } }))}
                        className="w-full px-1 py-1 bg-white border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900 cursor-pointer">
                        <option value={1}>1x</option>
                        <option value={2}>2x</option>
                      </select>

                      {/* Barcode Box */}
                      <span className="text-slate-900 normal-case font-extrabold">Barcode</span>
                      <input type="number" step={0.5} min={0} max={Math.max(0, effLabelWidth - effBarcodeWidth)} value={config.layoutXY.barcode.x}
                        onChange={e => updateConfig(p => ({ ...p, layoutXY: { ...p.layoutXY, barcode: { ...p.layoutXY.barcode, x: e.target.value } } }))}
                        className="w-full px-1 py-1 bg-white border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900" />
                      <input type="number" step={0.5} min={0} max={Math.max(0, effLabelHeight - effBarcodeHeight)} value={config.layoutXY.barcode.y}
                        onChange={e => updateConfig(p => ({ ...p, layoutXY: { ...p.layoutXY, barcode: { ...p.layoutXY.barcode, y: e.target.value } } }))}
                        className="w-full px-1 py-1 bg-white border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900" />
                      <input type="number" step={0.5} min={10} max={effLabelWidth} value={config.barcodeWidth}
                        onChange={e => updateConfig(p => ({ ...p, barcodeWidth: e.target.value }))}
                        className="w-full px-1 py-1 bg-white border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900" />
                      <input type="number" step={0.5} min={3} max={effLabelHeight} value={config.barcodeHeight}
                        onChange={e => updateConfig(p => ({ ...p, barcodeHeight: e.target.value }))}
                        className="w-full px-1 py-1 bg-white border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900" />

                      {/* Price */}
                      <span className="text-slate-800 normal-case font-bold">Price</span>
                      <input type="number" step={0.5} min={0} max={Math.max(0, effLabelWidth - 5)} value={config.layoutXY.price.x}
                        onChange={e => updateConfig(p => ({ ...p, layoutXY: { ...p.layoutXY, price: { ...p.layoutXY.price, x: e.target.value } } }))}
                        className="w-full px-1 py-1 bg-white border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900" />
                      <input type="number" step={0.5} min={0} max={Math.max(0, effLabelHeight - 3)} value={config.layoutXY.price.y}
                        onChange={e => updateConfig(p => ({ ...p, layoutXY: { ...p.layoutXY, price: { ...p.layoutXY.price, y: e.target.value } } }))}
                        className="w-full px-1 py-1 bg-white border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900" />
                      <span className="text-[9px] text-slate-400 text-center">—</span>
                      <select value={config.fontSize.price} onChange={e => updateConfig(p => ({ ...p, fontSize: { ...p.fontSize, price: Number(e.target.value) as 1 | 2 } }))}
                        className="w-full px-1 py-1 bg-white border border-slate-200 rounded text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-gray-900 cursor-pointer">
                        <option value={1}>1x</option>
                        <option value={2}>2x</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Live Interactive Canvas Preview & Bulk Print */}
        <div className="lg:col-span-6 space-y-6">

          {/* Card 1: Interactive Canvas & Sample Product Picker */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Tag className="w-5 h-5 text-gray-900" />
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Live Interactive Label Canvas
                </h3>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-500">Sample Item:</span>
                <select
                  value={sampleProductId}
                  onChange={e => setSampleProductId(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-gray-900 max-w-[180px] cursor-pointer"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Canvas Container */}
            <div className="bg-slate-200/60 p-6 rounded-xl border border-slate-300 flex flex-col items-center justify-center min-h-[260px] shadow-inner relative overflow-hidden">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                {effLabelWidth.toFixed(0)} × {effLabelHeight.toFixed(0)}mm ({config.paperMode})
              </p>

              {config.customLayout ? (
                <div
                  className="bg-white border border-slate-400 rounded shadow-md select-none overflow-hidden touch-none relative"
                  style={{ width: previewW, height: previewH }}
                >
                  {config.showStoreName && (
                    <div
                      className="absolute font-extrabold uppercase text-slate-700 truncate cursor-move hover:ring-1 hover:ring-slate-400 p-0.5 rounded"
                      style={{
                        left: effLayoutX('store') * previewScale,
                        top: effLayoutY('store') * previewScale,
                        width: Math.max(10, (effLabelWidth - effLayoutX('store')) * previewScale),
                        fontSize: 8 * config.fontSize.store,
                      }}
                      onPointerDown={(e) => handlePointerDown(e, 'move-store')}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                    >
                      {config.storeName || businessName || 'My Store'}
                    </div>
                  )}

                  {config.showProductName && (
                    <p
                      className="absolute font-extrabold text-slate-900 leading-tight truncate cursor-move hover:ring-1 hover:ring-slate-400 p-0.5 rounded"
                      style={{
                        left: effLayoutX('product') * previewScale,
                        top: effLayoutY('product') * previewScale,
                        width: Math.max(10, (effLabelWidth - effLayoutX('product')) * previewScale),
                        fontSize: 8 * config.fontSize.product,
                      }}
                      onPointerDown={(e) => handlePointerDown(e, 'move-product')}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                    >
                      {sampleProduct.name}
                    </p>
                  )}

                  {/* BARCODE BOX WITH HANDLES */}
                  <div
                    className="absolute border border-dashed border-slate-900 bg-slate-900/5 flex flex-col items-center justify-between rounded cursor-move select-none p-0.5"
                    style={{
                      left: effBarcodeX * previewScale,
                      top: effBarcodeY * previewScale,
                      width: effBarcodeWidth * previewScale,
                      height: effBarcodeHeight * previewScale,
                    }}
                    onPointerDown={(e) => handlePointerDown(e, 'move-barcode')}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    title={`Drag box to move, handles to resize (${effBarcodeWidth.toFixed(1)}×${effBarcodeHeight.toFixed(1)}mm)`}
                  >
                    <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden pointer-events-none">
                      <BarcodeSVG value={sampleCodeVal} height={Math.max(8, effBarcodeHeight * previewScale - (config.showCodeText ? 10 : 2))} showValue={false} />
                      {config.showCodeText && (
                        <div className="font-mono font-bold text-slate-900 text-center truncate w-full text-[8px]">
                          {sampleCodeVal}
                        </div>
                      )}
                    </div>

                    <div
                      className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-4 bg-slate-900 border border-white rounded-2xs cursor-ew-resize opacity-80 hover:opacity-100 z-10"
                      title="Resize Barcode Width"
                      onPointerDown={(e) => handlePointerDown(e, 'resize-barcode-e')}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                    />
                    <div
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-2 bg-slate-900 border border-white rounded-2xs cursor-ns-resize opacity-80 hover:opacity-100 z-10"
                      title="Resize Barcode Height"
                      onPointerDown={(e) => handlePointerDown(e, 'resize-barcode-s')}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                    />
                    <div
                      className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-black border border-white rounded-2xs cursor-nwse-resize opacity-90 hover:opacity-100 z-10"
                      title="Resize Barcode Box"
                      onPointerDown={(e) => handlePointerDown(e, 'resize-barcode-se')}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                    />
                  </div>

                  {config.showPrice && (
                    <div
                      className="absolute bg-slate-900 text-white rounded flex items-center justify-center cursor-move p-0.5"
                      style={{
                        left: effLayoutX('price') * previewScale,
                        top: effLayoutY('price') * previewScale,
                        width: Math.max(12, (effLabelWidth - effLayoutX('price')) * previewScale),
                        fontSize: Math.max(7, 4 * config.fontSize.price),
                      }}
                      onPointerDown={(e) => handlePointerDown(e, 'move-price')}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                    >
                      <span className="font-extrabold font-mono px-1 truncate">
                        {sampleProduct.price.toLocaleString()} {currencySymbol}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="bg-white border border-slate-400 rounded shadow-md flex flex-col items-center justify-center text-center select-none overflow-hidden p-2"
                  style={{ width: previewW, height: previewH }}
                >
                  {config.showStoreName && (
                    <span className="text-[8px] font-extrabold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-0.5 w-full truncate">
                      {config.storeName || businessName || 'My Store'}
                    </span>
                  )}
                  {config.showProductName && (
                    <p className="font-extrabold text-[9px] text-slate-900 leading-tight line-clamp-2 w-full px-0.5 my-0.5">
                      {sampleProduct.name}
                    </p>
                  )}
                  <div className="my-0.5 px-0.5 flex items-center justify-center overflow-hidden" style={{ width: effBarcodeWidth * previewScale, height: effBarcodeHeight * previewScale }}>
                    <BarcodeSVG value={sampleCodeVal} height={Math.max(10, effBarcodeHeight * previewScale - (config.showCodeText ? 10 : 0))} showValue={config.showCodeText} />
                  </div>
                  {config.showPrice && (
                    <div className="w-full flex items-center justify-center bg-slate-900 text-white rounded py-0.5 px-1 mt-0.5">
                      <span className="font-extrabold font-mono text-[9px] leading-none">
                        {sampleProduct.price.toLocaleString()} {currencySymbol}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Bulk Print Selection */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-gray-900" />
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Bulk Inventory Label Print
                </h3>
              </div>

              <span className="text-xs font-bold text-slate-600">
                Total Labels: <strong className="text-black font-extrabold">{printItemsList.length}</strong>
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2 text-xs">
                <button onClick={selectAll} className="text-gray-900 font-bold hover:underline cursor-pointer">All</button>
                <span className="text-slate-300">|</span>
                <button onClick={deselectAll} className="text-slate-500 hover:underline cursor-pointer">None</button>
                <span className="text-slate-300">|</span>
                <button onClick={() => setAllQuantities('stock')} className="text-slate-600 font-bold hover:underline cursor-pointer">Qty = Stock</button>
              </div>

              {btAvailable && (
                <button
                  onClick={handleBtPrintBulk}
                  disabled={printItemsList.length === 0 || !btConnected || btPrinting}
                  className="px-4 py-2 bg-black hover:bg-gray-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {btPrinting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                  <span>
                    {btPrinting ? `Printing ${btProgress.current}/${btProgress.total}` : `Print ${printItemsList.length} Labels`}
                  </span>
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute inset-y-0 left-0 pl-3 w-4 h-4 my-auto text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Filter by product name, SKU, or barcode..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-gray-900"
              />
            </div>

            <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
              {filteredProducts.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-400">No products found.</p>
              ) : (
                filteredProducts.map(prod => {
                  const isSelected = selectedProducts[prod.id] !== undefined;
                  const qty = selectedProducts[prod.id] || 0;
                  const code = prod.barcode || prod.sku;
                  return (
                    <div
                      key={prod.id}
                      className={`p-2.5 rounded-xl border transition-all flex items-center justify-between text-xs ${
                        isSelected ? 'bg-slate-50 border-gray-300' : 'bg-white border-slate-100 hover:bg-slate-50'
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
                        <div className="flex items-center space-x-1 shrink-0 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
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

      </div>

    </div>
  );
};

export default LabelGeneratorTab;
