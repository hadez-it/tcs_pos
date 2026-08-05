import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { dbService, isSupabaseConfigured } from '../lib/supabase';

export default function OfflineSyncBar() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      if (isSupabaseConfigured) {
        setSyncStatus('Reconnected! Syncing offline data to database...');
        const res = await dbService.sync.syncOfflineData();
        setSyncStatus(res.message);
        if (res.success) {
          setTimeout(() => setSyncStatus(null), 4000);
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('You are offline. All sales & changes are saved locally on this device.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Nothing worth a bar while online and idle — stay out of the way.
  if (isOnline && !syncStatus) return null;

  return (
    <div className="w-full bg-slate-900 text-white px-3 py-1.5 text-xs font-medium flex items-center justify-between border-b border-slate-800">
      <div className="flex items-center space-x-2">
        {!isOnline && (
          <div className="flex items-center space-x-1.5 text-amber-400 animate-pulse">
            <WifiOff className="w-3.5 h-3.5" />
            <span className="font-semibold text-[11px]">Offline Mode (Local Storage Active)</span>
          </div>
        )}

        {syncStatus && (
          <span
            className={`text-slate-300 text-[11px] ${
              isOnline ? '' : 'hidden sm:inline border-l border-slate-700 pl-2'
            }`}
          >
            {syncStatus}
          </span>
        )}
      </div>

      {!isOnline && (
        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 font-mono shrink-0">
          Auto Sync on Reconnect
        </span>
      )}
    </div>
  );
}
