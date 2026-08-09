import React, { useEffect, useState, useCallback } from 'react';
import { useZxing } from 'react-zxing';
import { X, Camera, Zap, ZapOff, SwitchCamera, Volume2 } from 'lucide-react';
import { useBackDismiss } from '../lib/backNavigation';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export default function BarcodeScannerModal({ isOpen, onClose, onScan }: BarcodeScannerModalProps) {
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceIdx, setSelectedDeviceIdx] = useState(0);

  useBackDismiss(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) {
      setLastScanned(null);
      setScanCount(0);
      setHasPermission(null);
      setPermissionError(null);
      return;
    }

    navigator.mediaDevices?.enumerateDevices().then(allDevices => {
      const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
      setDevices(videoDevices);
      const backIdx = videoDevices.findIndex(d =>
        d.label.toLowerCase().includes('back') ||
        d.label.toLowerCase().includes('rear') ||
        d.label.toLowerCase().includes('environment')
      );
      if (backIdx >= 0) setSelectedDeviceIdx(backIdx);
    }).catch(() => {});
  }, [isOpen]);

  const handleDecode = useCallback((result: { rawValue: string }) => {
    const code = result.rawValue;
    if (!code || code === lastScanned) return;
    setLastScanned(code);
    setScanCount(prev => prev + 1);

    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }
    } catch {}

    onScan(code);
  }, [lastScanned, onScan]);

  const selectedDevice = devices[selectedDeviceIdx];

  const { ref, torch } = useZxing({
    paused: !isOpen,
    ...(selectedDevice?.deviceId
      ? { deviceId: selectedDevice.deviceId }
      : { constraints: { video: { facingMode: 'environment' } } }),
    formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'codabar', 'qr_code'],
    timeBetweenDecodingAttempts: 300,
    onDecodeResult: handleDecode,
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied')) {
        setHasPermission(false);
        setPermissionError('Camera permission denied. Please allow camera access in your browser or device settings.');
      } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
        setHasPermission(false);
        setPermissionError('No camera found on this device.');
      } else {
        setHasPermission(false);
        setPermissionError('Unable to start camera. Please check permissions and try again.');
      }
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    const video = ref.current;
    if (!video) return;
    const handlePlaying = () => setHasPermission(true);
    video.addEventListener('playing', handlePlaying);
    return () => video.removeEventListener('playing', handlePlaying);
  }, [isOpen, ref]);

  const handleSwitchCamera = () => {
    if (devices.length > 1) {
      setSelectedDeviceIdx(prev => (prev + 1) % devices.length);
      setLastScanned(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white sm:rounded-3xl rounded-t-3xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] shadow-2xl animate-slide-up">
        <div className="pt-3 pb-1 sm:hidden">
          <div className="pull-indicator" />
        </div>

        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">Scan Barcode</h4>
              <p className="text-[10px] text-slate-400 font-medium">Point camera at barcode</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {devices.length > 1 && (
              <button
                onClick={handleSwitchCamera}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                title="Switch camera"
              >
                <SwitchCamera className="w-4.5 h-4.5" />
              </button>
            )}
            {torch.isAvailable && (
              <button
                onClick={torch.isOn ? torch.off : torch.on}
                className={`p-2 rounded-xl cursor-pointer transition-colors ${torch.isOn ? 'bg-yellow-100 text-yellow-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                title={torch.isOn ? 'Turn off flashlight' : 'Turn on flashlight'}
              >
                {torch.isOn ? <Zap className="w-4.5 h-4.5" /> : <ZapOff className="w-4.5 h-4.5" />}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="relative bg-black flex-1 min-h-[300px] max-h-[400px] overflow-hidden">
          {hasPermission === false ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
                <Camera className="w-8 h-8 text-white/50" />
              </div>
              <p className="text-white/90 text-sm font-semibold mb-1">Camera Access Required</p>
              <p className="text-white/50 text-xs leading-relaxed">{permissionError}</p>
              <button
                onClick={onClose}
                className="mt-4 px-5 py-2.5 bg-white text-black rounded-xl text-xs font-bold cursor-pointer hover:bg-white/90 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <video
                ref={ref}
                className="w-full h-full object-cover"
                playsInline
                muted
              />

              {hasPermission === null && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                  <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin mb-3" />
                  <p className="text-white/70 text-xs font-medium">Starting camera...</p>
                </div>
              )}

              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-black/40" style={{
                  maskImage: 'radial-gradient(ellipse 60% 45% at center, transparent 0%, black 100%)',
                  WebkitMaskImage: 'radial-gradient(ellipse 60% 45% at center, transparent 0%, black 100%)',
                }} />

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] aspect-[3/2]">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-white rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-white rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-white rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-white rounded-br-lg" />

                  <div className="absolute top-1/2 left-[10%] right-[10%] h-0.5 -translate-y-1/2">
                    <div className="w-full h-full bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-70 animate-pulse" />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-3.5 bg-white safe-area-bottom">
          {lastScanned ? (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center shrink-0">
                <Volume2 className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Last Scanned</p>
                <p className="text-sm font-mono font-bold text-slate-900 truncate">{lastScanned}</p>
              </div>
              <span className="shrink-0 text-[10px] font-bold bg-black text-white px-2 py-0.5 rounded-full">{scanCount}</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-3 text-slate-400">
              <div className="w-2 h-2 rounded-full bg-slate-300 animate-pulse" />
              <p className="text-xs font-medium">Waiting for barcode...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
