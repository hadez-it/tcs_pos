import React, { useState, useEffect, useCallback } from 'react';
import { 
  Printer, X, Search, CheckSquare, Square, Settings2, 
  Tag, Store, DollarSign, Layers, Plus, Minus, RotateCcw,
  Bluetooth, BluetoothOff, Loader2, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Product, Branch } from '../types';
import BarcodeSVG from './BarcodeSVG';
import * as printerBridge from '../lib/printerBridge';
import { buildLabel, init as escInit, setCodePage } from '../lib/escpos';

interface BarcodePrintModalProps {
  products: Product[];
  branches: Branch[];
  isOpen: boolean;
  onClose: () => void;
  selectedProductId?: string | null;
}

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  products,
  branches,
  isOpen,
  onClose,
  selectedProductId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [storeName, setStoreName] = useState('My Retail Store');
  
  // Map of productId -> print quantity
  const [selectedProducts, setSelectedProducts] = useState<{ [id: string]: number }>(() => {
    const initialMap: { [id: string]: number } = {};
    if (selectedProductId) {
      const prod = products.find(p => p.id === selectedProductId);
      if (prod) {
        initialMap[prod.id] = Math.max(1, prod.stock || 1);
      }
    } else {
      // Default select all products with quantity 1
      products.forEach(p => {
        initialMap[p.id] = 1;
      });
    }
    return initialMap;
  });

  // Display Settings
  const [showStoreName, setShowStoreName] = useState(true);
  const [showProductName, setShowProductName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showCodeText, setShowCodeText] = useState(true);
  
  // Label Size Presets
  // 'small' = 38x25mm, 'standard' = 50x25mm, 'large' = 60x40mm, 'a4' = A4 sheet grid
  const [labelSize, setLabelSize] = useState<'small' | 'standard' | 'large' | 'a4'>('standard');

  // ── Printer State (native SPP in Android shell, Web BT in browser) ────────
  const isNative = printerBridge.isNativeShell();
  const [btAvailable] = useState(() => printerBridge.isBluetoothAvailable());
  const [btConnected, setBtConnected] = useState(() => printerBridge.isConnected());
  const [printerName, setPrinterName] = useState(() => printerBridge.getDeviceName());
  const [btConnecting, setBtConnecting] = useState(false);
  const [btPrinting, setBtPrinting] = useState(false);
  const [btProgress, setBtProgress] = useState({ current: 0, total: 0 });
  const [btError, setBtError] = useState<string | null>(null);
  // Native: picking from the phone's already-paired printers (no chooser).
  const [pairedDevices, setPairedDevices] = useState<printerBridge.PairedPrinter[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');

  // Compute print items list early (needed by handleBtPrint)
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

  // Listen for printer disconnect events
  useEffect(() => {
    if (!isOpen) return;
    if (isNative) {
      // Load the phone's paired printers so the user can pick one directly.
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
        setBtError(null); // User cancelled — don't show error
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

  const handleBtPrint = useCallback(async () => {
    if (!printerBridge.isConnected() || printItemsList.length === 0 || btPrinting) return;

    setBtPrinting(true);
    setBtError(null);
    setBtProgress({ current: 0, total: printItemsList.length });

    try {
      // Send init command first
      await printerBridge.send(escInit());
      await printerBridge.send(setCodePage('CP437'));

      // Send each label
      for (let i = 0; i < printItemsList.length; i++) {
        const item = printItemsList[i];
        const codeVal = item.product.barcode || item.product.sku || '000000';

        const labelData = buildLabel({
          storeName,
          productName: item.product.name,
          barcodeValue: codeVal,
          price: item.product.price,
          showStoreName,
          showProductName,
          showPrice,
          showBarcodeText: showCodeText,
          currencySymbol: '$',
        });

        await printerBridge.send(labelData);
        setBtProgress({ current: i + 1, total: printItemsList.length });

        // Brief delay between labels to let printer process
        if (i < printItemsList.length - 1) {
          await new Promise(r => setTimeout(r, 200));
        }
      }
    } catch (err: any) {
      setBtError(err?.message || 'Print failed. Check printer connection.');
      // If connection was lost, update state
      if (!printerBridge.isConnected()) {
        setBtConnected(false);
        setPrinterName('');
      }
    } finally {
      setBtPrinting(false);
      setBtProgress({ current: 0, total: 0 });
    }
  }, [printItemsList, storeName, showStoreName, showProductName, showPrice, showCodeText, btPrinting]);

  if (!isOpen) return null;

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const toggleSelectProduct = (id: string, defaultQty: number = 1) => {
    setSelectedProducts(prev => {
      const copy = { ...prev };
      if (copy[id] !== undefined) {
        delete copy[id];
      } else {
        copy[id] = defaultQty > 0 ? defaultQty : 1;
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

  const deselectAll = () => {
    setSelectedProducts({});
  };

  const updateQuantity = (id: string, qty: number) => {
    if (qty <= 0) {
      setSelectedProducts(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    } else {
      setSelectedProducts(prev => ({
        ...prev,
        [id]: qty,
      }));
    }
  };

  const totalLabels = printItemsList.length;

  const handlePrint = () => {
    window.print();
  };

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
                Inventory Barcode Label Generator
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Customize, preview, and print barcodes for sticker labels & price tags
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Bluetooth Printer Controls */}
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
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded-lg shadow-xs transition-all flex items-center space-x-1 disabled:opacity-50"
                    >
                      {btConnecting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Bluetooth className="w-3 h-3" />
                      )}
                      <span>{btConnecting ? 'Connecting...' : 'Connect Printer'}</span>
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Browser Print Button */}
            <button
              onClick={handlePrint}
              disabled={totalLabels === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Print {totalLabels} Labels</span>
            </button>

            {/* Bluetooth Print Button */}
            {btAvailable && (
              <button
                onClick={handleBtPrint}
                disabled={totalLabels === 0 || !btConnected || btPrinting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 disabled:opacity-50"
              >
                {btPrinting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Bluetooth className="w-4 h-4" />
                )}
                <span>
                  {btPrinting
                    ? `Printing ${btProgress.current}/${btProgress.total}`
                    : 'BT Print'
                  }
                </span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY (TWO PANELS: SETTINGS/SELECTION & LIVE PREVIEW) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          
          {/* LEFT PANEL: PRODUCT SELECTOR & CUSTOMIZATION (5 COLS) */}
          <div className="lg:col-span-5 flex flex-col overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            
            {/* STORE NAME & DISPLAY TOGGLES */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <Settings2 className="w-4 h-4 text-indigo-600" />
                  <span>Label Design Options</span>
                </span>
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

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-700 pt-1">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStoreName}
                    onChange={e => setShowStoreName(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Store Name</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showProductName}
                    onChange={e => setShowProductName(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Product Title</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={e => setShowPrice(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Selling Price</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCodeText}
                    onChange={e => setShowCodeText(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>SKU / BC Text</span>
                </label>
              </div>

              {/* Label Size Selection */}
              <div className="pt-2 border-t border-slate-100">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Label Sticker Preset
                </label>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <button
                    onClick={() => setLabelSize('standard')}
                    className={`px-2 py-1.5 rounded-lg border font-bold text-[11px] transition-all text-center ${
                      labelSize === 'standard' 
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs' 
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Standard (50×25mm)
                  </button>
                  <button
                    onClick={() => setLabelSize('small')}
                    className={`px-2 py-1.5 rounded-lg border font-bold text-[11px] transition-all text-center ${
                      labelSize === 'small' 
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs' 
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Compact (38×25mm)
                  </button>
                  <button
                    onClick={() => setLabelSize('large')}
                    className={`px-2 py-1.5 rounded-lg border font-bold text-[11px] transition-all text-center ${
                      labelSize === 'large' 
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs' 
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Large Tag (60×40mm)
                  </button>
                  <button
                    onClick={() => setLabelSize('a4')}
                    className={`px-2 py-1.5 rounded-lg border font-bold text-[11px] transition-all text-center ${
                      labelSize === 'a4' 
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs' 
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    A4 Sheet Grid (24/page)
                  </button>
                </div>
              </div>
            </div>

            {/* PRODUCT SELECTION TABLE */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex-1 flex flex-col min-h-[280px]">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-extrabold text-slate-800">Select Products to Print</span>
                <div className="flex items-center space-x-1.5 text-[10px]">
                  <button
                    onClick={selectAll}
                    className="text-indigo-600 font-bold hover:underline"
                  >
                    All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={deselectAll}
                    className="text-slate-500 hover:underline"
                  >
                    None
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => setAllQuantities('stock')}
                    className="text-slate-600 font-medium hover:underline"
                    title="Set label quantity equal to current inventory stock"
                  >
                    Qty = Stock
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative mb-2">
                <Search className="absolute inset-y-0 left-0 pl-2.5 w-3.5 h-3.5 my-auto text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Filter by product name, SKU..."
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Product List */}
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
                          isSelected 
                            ? 'bg-indigo-50/50 border-indigo-200' 
                            : 'bg-white border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                          <button
                            onClick={() => toggleSelectProduct(prod.id, prod.stock)}
                            className="text-indigo-600 shrink-0"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate text-[11px]">{prod.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              {code} • <span className="font-semibold text-slate-700">${prod.price}</span>
                            </p>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="flex items-center space-x-1 shrink-0 bg-white border border-slate-200 rounded-md p-0.5 shadow-2xs">
                            <button
                              onClick={() => updateQuantity(prod.id, qty - 1)}
                              className="w-5 h-5 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded font-bold"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center font-bold text-xs font-mono">{qty}</span>
                            <button
                              onClick={() => updateQuantity(prod.id, qty + 1)}
                              className="w-5 h-5 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded font-bold"
                            >
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

          {/* RIGHT PANEL: LIVE PRINT PREVIEW SHEET (7 COLS) */}
          <div className="lg:col-span-7 flex flex-col overflow-hidden bg-slate-100/70 p-4">
            
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-indigo-600" />
                <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                  Live Print Preview ({totalLabels} total sticker labels)
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrint}
                  disabled={totalLabels === 0}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Sheet</span>
                </button>

                {btAvailable && (
                  <button
                    onClick={handleBtPrint}
                    disabled={totalLabels === 0 || !btConnected || btPrinting}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    {btPrinting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Bluetooth className="w-3.5 h-3.5" />
                    )}
                    <span>{btPrinting ? `${btProgress.current}/${btProgress.total}` : 'BT Print'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bluetooth Error Banner */}
            {btError && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{btError}</span>
                <button onClick={() => setBtError(null)} className="text-red-400 hover:text-red-600">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* PREVIEW CONTAINER */}
            <div className="flex-1 overflow-y-auto bg-slate-200/50 p-4 rounded-xl border border-slate-300 shadow-inner flex justify-center">
              {totalLabels === 0 ? (
                <div className="m-auto text-center py-16 text-slate-400 text-xs">
                  <Printer className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold text-slate-600">No products selected to print.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Check the product boxes on the left to add barcode labels.</p>
                </div>
              ) : (
                <div 
                  id="barcode-printable-area"
                  className={`bg-white shadow-lg p-4 rounded border border-slate-300 w-full max-w-[650px] ${
                    labelSize === 'small' 
                      ? 'grid grid-cols-3 sm:grid-cols-4 gap-2' 
                      : labelSize === 'standard' 
                        ? 'grid grid-cols-2 sm:grid-cols-3 gap-2.5' 
                        : labelSize === 'large' 
                          ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' 
                          : 'grid grid-cols-3 gap-2'
                  }`}
                >
                  {printItemsList.map((item, idx) => {
                    const codeVal = item.product.barcode || item.product.sku || '000000';

                    return (
                      <div
                        key={idx}
                        className="bg-white border border-slate-900/80 p-2 rounded flex flex-col items-center justify-between text-center select-none shadow-2xs overflow-hidden"
                        style={{
                          minHeight: labelSize === 'small' ? '90px' : labelSize === 'large' ? '140px' : '110px'
                        }}
                      >
                        {/* Header Store Name */}
                        {showStoreName && (
                          <span className="text-[8px] font-extrabold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-0.5 w-full truncate">
                            {storeName}
                          </span>
                        )}

                        {/* Product Title */}
                        {showProductName && (
                          <p className="font-extrabold text-[10px] text-slate-900 leading-tight my-1 line-clamp-2 w-full px-1">
                            {item.product.name}
                          </p>
                        )}

                        {/* Barcode Graphic */}
                        <div className="w-full my-0.5 px-1">
                          <BarcodeSVG
                            value={codeVal}
                            height={labelSize === 'small' ? 30 : labelSize === 'large' ? 50 : 38}
                            showValue={showCodeText}
                          />
                        </div>

                        {/* Price Tag Footer */}
                        {showPrice && (
                          <div className="w-full flex items-center justify-center bg-slate-900 text-white rounded py-0.5 px-1 mt-1">
                            <span className="font-extrabold font-mono text-[11px] leading-none">
                              ${Number(item.product.price).toFixed(2)}
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
            Total Labels to Print: <strong className="text-slate-900 font-bold">{totalLabels}</strong>
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors"
            >
              Cancel
            </button>

            {/* Browser Print */}
            <button
              onClick={handlePrint}
              disabled={totalLabels === 0}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Print {totalLabels} Labels</span>
            </button>

            {/* Bluetooth Print */}
            {btAvailable && (
              <button
                onClick={handleBtPrint}
                disabled={totalLabels === 0 || !btConnected || btPrinting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1.5 disabled:opacity-50"
              >
                {btPrinting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Bluetooth className="w-4 h-4" />
                )}
                <span>
                  {btPrinting
                    ? `Printing ${btProgress.current}/${btProgress.total}`
                    : `BT Print ${totalLabels} Labels`
                  }
                </span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* PRINT MEDIA STYLES (ONLY PRINTS THE BARCODE PRINTABLE AREA) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #barcode-printable-area, #barcode-printable-area * {
            visibility: visible !important;
          }
          #barcode-printable-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 10px !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 8px !important;
          }
          @page {
            size: auto;
            margin: 5mm;
          }
        }
      `}</style>
    </div>
  );
};

export default BarcodePrintModal;
