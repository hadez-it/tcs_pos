import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineSyncBar() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="w-full bg-slate-900 text-white px-3 py-1.5 text-xs font-medium flex items-center gap-2 border-b border-slate-800">
      <WifiOff className="w-3.5 h-3.5 text-slate-400 shrink-0 animate-pulse" />
      <span className="text-slate-300 text-[11px] font-semibold">No internet connection — data cannot be loaded or saved until you reconnect.</span>
    </div>
  );
}
