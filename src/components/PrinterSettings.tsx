import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer, Tag, Receipt, Bluetooth, BluetoothOff, Loader2, CheckCircle2,
  AlertCircle, Save, X, RefreshCw, Cable, Radio, Info
} from 'lucide-react';
import * as bluetoothPrinter from '../lib/bluetoothPrinter';
import { buildLabel, text, separator, feed, cut, init as escInit, setCodePage } from '../lib/escpos';
import { useToast } from '../utils/toast';

// PRINTER_ROLE keys: role -> immutable localStorage key
const BARCODE_KEY = 'mibayate_barcode_printer';
const SLIP_KEY = 'mibayate_slip_printer';

export type PrinterRole = 'barcode' | 'slip';

interface PrinterSettingsProps {
  storeName: string;
}

function loadAssignedName(key: string): string {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return typeof parsed?.name === 'string' ? parsed.name : '';
    }
  } catch { /* ignore malformed localStorage */ }
  return '';
}

function saveAssignedName(key: string, name: string): void {
  localStorage.setItem(key, JSON.stringify({ name, updated_at: new Date().toISOString() }));
}

export const PrinterSettings: React.FC<PrinterSettingsProps> = ({ storeName }) => {
  const { toast } = useToast();

  // ── Configuration (which physical printer serves each role) ───────────────
  const [barcodeName, setBarcodeName] = useState(() => loadAssignedName(BARCODE_KEY));
  const [slipName, setSlipName] = useState(() => loadAssignedName(SLIP_KEY));

  // ── Live Web Bluetooth connection state (singleton) ───────────────────────
  const [btAvailable] = useState(() => bluetoothPrinter.isWebBluetoothAvailable());
  const [btConnected, setBtConnected] = useState(() => bluetoothPrinter.isConnected());
  const [printerName, setPrinterName] = useState(() => bluetoothPrinter.getPrinterName());
  const [connectingRole, setConnectingRole] = useState<PrinterRole | null>(null);
  const [testingRole, setTestingRole] = useState<PrinterRole | null>(null);
  const [btError, setBtError] = useState<string | null>(null);

  useEffect(() => {
    bluetoothPrinter.onDisconnect(() => {
      setBtConnected(false);
      setPrinterName('');
    });
    return () => bluetoothPrinter.offDisconnect();
  }, []);

  const handleConnect = async (role: PrinterRole) => {
    if (connectingRole) return;
    setBtError(null);
    setConnectingRole(role);
    try {
      const name = await bluetoothPrinter.connect();
      setBtConnected(true);
      setPrinterName(name);
      setBtError(null);
    } catch (err: any) {
      if (err?.name !== 'NotFoundError') {
        setBtError(err?.message || 'Failed to connect to printer');
        setBtConnected(false);
      }
    } finally {
      setConnectingRole(null);
    }
  };

  const handleDisconnect = () => {
    bluetoothPrinter.disconnect();
    setBtConnected(false);
    setPrinterName('');
  };

  const handleAssign = (role: PrinterRole) => {
    if (!btConnected || !printerName) return;
    if (role === 'barcode') {
      setBarcodeName(printerName);
      saveAssignedName(BARCODE_KEY, printerName);
    } else {
      setSlipName(printerName);
      saveAssignedName(SLIP_KEY, printerName);
    }
    toast(`"${printerName}" set as ${role === 'barcode' ? 'Barcode' : 'Slip'} printer.`, 'success');
  };

  const handleTestPrint = useCallback(async (role: PrinterRole) => {
    if (!bluetoothPrinter.isConnected() || testingRole) return;
    setTestingRole(role);
    setBtError(null);
    try {
      await bluetoothPrinter.send(escInit());
      await bluetoothPrinter.send(setCodePage('CP437'));

      if (role === 'barcode') {
        await bluetoothPrinter.send(buildLabel({
          storeName: storeName || 'My Store',
          productName: 'Test Product',
          barcodeValue: '0123456789012',
          price: 25,
          currencySymbol: 'Ks',
        }));
      } else {
        const rows = [
          text(storeName || 'My Store', { align: 'center', bold: true, width: 2, height: 2 }),
          separator('-', 32),
          text('TEST RECEIPT', { align: 'center', bold: true }),
          separator('-', 32),
          text('1 x Test Product     25.00'),
          text('Total              25.00'),
          text('Change               0.00'),
          separator('=', 32),
          text('Thank you for shopping!', { align: 'center' }),
          feed(4),
          cut(),
        ];
        for (const r of rows) {
          await bluetoothPrinter.send(r);
          await new Promise(res => setTimeout(res, 60));
        }
      }

      toast(`${role === 'barcode' ? 'Barcode' : 'Slip'} test printed.`, 'success');
    } catch (err: any) {
      setBtError(err?.message || 'Test print failed. Check printer connection.');
      if (!bluetoothPrinter.isConnected()) {
        setBtConnected(false);
        setPrinterName('');
      }
    } finally {
      setTestingRole(null);
    }
  }, [storeName, testingRole]);

  const roleSpecs: Array<{
    role: PrinterRole;
    label: string;
    tagline: string;
    accent: 'indigo' | 'emerald';
    icon: typeof Tag;
    assignedName: string;
    example: string;
  }> = [
    {
      role: 'barcode',
      label: 'Barcode Label Printer',
      tagline: 'Prints product price tags & barcode stickers',
      accent: 'indigo',
      icon: Tag,
      assignedName: barcodeName,
      example: 'e.g. Rongta BT80 / Gprinter LW-500'
    },
    {
      role: 'slip',
      label: 'Slip / Receipt Printer',
      tagline: 'Prints thermal sales receipts at the POS',
      accent: 'emerald',
      icon: Receipt,
      assignedName: slipName,
      example: 'e.g. Epson TM-T20 / Xprinter 58mm'
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-7 rounded-2xl shadow-lg border border-slate-800 relative overflow-hidden">
        {/* Decorative mesh / glow accents */}
        <div className="pointer-events-none absolute -top-20 -right-16 w-64 h-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 w-72 h-72 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-200 text-xs font-bold border border-indigo-400/30">
              <Printer className="w-3.5 h-3.5" />
              <span>Devices & Peripherals</span>
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold tracking-tight">Barcode & Slip Printer Setup</h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Pair your thermal printers over Bluetooth and assign each device to its role —
              barcode label printing or receipt (slip) printing. Assignments are saved on this device.
            </p>
          </div>

          {/* Live connection status cluster */}
          <div className="flex flex-wrap items-center gap-2">
            {!btAvailable ? (
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs font-bold">
                <Radio className="w-4 h-4" />
                Web Bluetooth unavailable
              </span>
            ) : btConnected ? (
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-xs font-bold max-w-[220px]">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="truncate">{printerName}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold">
                <BluetoothOff className="w-4 h-4" />
                Not connected
              </span>
            )}
          </div>
        </div>
      </div>

      {btError && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-start gap-2 shadow-xs animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{btError}</span>
          <button onClick={() => setBtError(null)} className="text-red-400 hover:text-red-600 cursor-pointer shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {btAvailable && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-1">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
            <Cable className="w-3.5 h-3.5" />
            Current live connection is shared across both printers. Connect a device, then assign it below.
          </div>
          {btConnected && (
            <button
              onClick={handleDisconnect}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-slate-200 rounded-xl font-bold text-[11px] transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <BluetoothOff className="w-3.5 h-3.5" />
              Disconnect
            </button>
          )}
        </div>
      )}

      {/* Printer Role Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {roleSpecs.map((spec) => {
          const accentText = spec.accent === 'indigo' ? 'text-indigo-600' : 'text-emerald-600';
          const accentBg = spec.accent === 'indigo' ? 'bg-indigo-600' : 'bg-emerald-600';
          const accentSoft = spec.accent === 'indigo' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700';
          const accentRing = spec.accent === 'indigo' ? 'focus:border-indigo-500' : 'focus:border-emerald-500';
          const hasAssigned = !!spec.assignedName;
          const connectedMatches = btConnected && printerName === spec.assignedName;

          return (
            <div
              key={spec.role}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col"
            >
              {/* Card header */}
              <div className="flex items-center gap-3 p-5 border-b border-slate-100 bg-slate-50/60">
                <div className={`p-2.5 rounded-xl text-white shadow-md ${accentBg}`}>
                  <spec.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-extrabold text-slate-900 text-sm">{spec.label}</h4>
                  <p className="text-[11px] text-slate-500">{spec.tagline}</p>
                </div>
                {hasAssigned ? (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${accentSoft}`}>
                    <CheckCircle2 className="w-3 h-3" />
                    {connectedMatches ? 'ACTIVE' : 'Configured'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                    Not set
                  </span>
                )}
              </div>

              <div className="p-5 space-y-4 flex-1">
                {/* Assigned device */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assigned Device</span>
                    {hasAssigned && (
                      <button
                        onClick={() => {
                          if (spec.role === 'barcode') { setBarcodeName(''); localStorage.removeItem(BARCODE_KEY); }
                          else { setSlipName(''); localStorage.removeItem(SLIP_KEY); }
                          toast(`${spec.label} assignment cleared.`, 'success');
                        }}
                        className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <p className={`font-mono text-sm font-bold break-all ${accentText}`}>
                    {spec.assignedName || '— no device assigned yet —'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1.5">{spec.example}</p>
                </div>

                {/* Live connected device */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {btConnected ? (
                      <span className={`w-2 h-2 rounded-full bg-emerald-500 animate-pulse-soft shrink-0`} />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Live connection</p>
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {btConnected ? printerName : 'No printer connected'}
                      </p>
                    </div>
                  </div>
                  <Bluetooth className="w-4 h-4 text-slate-300 shrink-0" />
                </div>

                {connectedMatches ? (
                  <p className="text-[11px] text-emerald-700 flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    This printer is using the {spec.label}.
                  </p>
                ) : hasAssigned && btConnected ? (
                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    Connected "{printerName}" differs from the assigned device.
                  </p>
                ) : null}
              </div>

              {/* Actions */}
              <div className="p-4 pt-0 flex flex-wrap gap-2">
                {!btConnected ? (
                  <button
                    onClick={() => handleConnect(spec.role)}
                    disabled={!!connectingRole || !btAvailable}
                    className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${accentBg}`}
                  >
                    {connectingRole === spec.role ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Bluetooth className="w-3.5 h-3.5" />
                        Connect Printer
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleAssign(spec.role)}
                      className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 ${accentBg}`}
                    >
                      <Save className="w-3.5 h-3.5" />
                      Assign to {spec.label.split(' ')[0]}
                    </button>
                    <button
                      onClick={() => handleTestPrint(spec.role)}
                      disabled={!!testingRole}
                      className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 cursor-pointer`}
                    >
                      {testingRole === spec.role ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Printer className="w-3.5 h-3.5" />
                      )}
                      Test
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tips card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw className="w-4 h-4 text-indigo-500" />
          <h5 className="font-extrabold text-slate-900 text-sm">Pairing & usage tips</h5>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[11px] text-slate-600 leading-relaxed list-disc list-inside">
          <li>Web Bluetooth needs Chrome/Edge on Android with an HTTPS connection.</li>
          <li>Choose the matching device from the system picker when it appears.</li>
          <li>Only one printer stays actively connected at a time on this device.</li>
          <li>Assignments persist locally, so you always know which printer is which.</li>
          <li>Use <strong>Test</strong> to confirm spacing before a real print run.</li>
        </ul>
      </div>
    </div>
  );
};

export default PrinterSettings;