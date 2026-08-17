import { supabase, isSupabaseConfigured } from './supabase';

type SyncListener = () => void | Promise<void>;

const listeners = new Set<SyncListener>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let realtimeChannel: any = null;
let broadcastChannel: BroadcastChannel | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;
let lastSyncTimestamp = 0;

const DEFAULT_POLL_INTERVAL_MS = 45000;
const DEBOUNCE_DELAY_MS = 600;
const MIN_SYNC_INTERVAL_MS = 2500;

const notifyListeners = (force = false) => {
  const now = Date.now();
  if (!force && now - lastSyncTimestamp < MIN_SYNC_INTERVAL_MS) {
    return;
  }

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(async () => {
    if (isSyncing) return;
    isSyncing = true;
    lastSyncTimestamp = Date.now();
    try {
      const callbacks = Array.from(listeners);
      await Promise.all(callbacks.map(cb => {
        try {
          const res = cb();
          return res instanceof Promise ? res.catch(err => console.warn('Sync listener failed:', err)) : Promise.resolve();
        } catch (err) {
          console.warn('Sync listener threw:', err);
          return Promise.resolve();
        }
      }));
    } finally {
      isSyncing = false;
    }
  }, DEBOUNCE_DELAY_MS);
};

export const notifyDataChanged = (table?: string) => {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: 'DATA_CHANGED', table, timestamp: Date.now() });
    } catch {
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pos:data-change', { detail: { table, timestamp: Date.now() } }));
  }

  notifyListeners(true);
};

const setupRealtimeChannel = () => {
  if (!isSupabaseConfigured || !supabase || realtimeChannel) return;

  try {
    realtimeChannel = supabase
      .channel('pos_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        () => {
          notifyListeners();
        }
      )
      .subscribe((status: string) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Supabase realtime channel issue:', status);
        }
      });
  } catch (err) {
    console.warn('Failed to initialize Supabase realtime channel:', err);
  }
};

const teardownRealtimeChannel = () => {
  if (realtimeChannel && supabase) {
    try {
      supabase.removeChannel(realtimeChannel);
    } catch {
    }
    realtimeChannel = null;
  }
};

const handleVisibilityOrFocus = () => {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    notifyListeners();
  }
};

const handleOnline = () => {
  notifyListeners(true);
};

const handleCustomDataChange = () => {
  notifyListeners(true);
};

const startSyncEngine = () => {
  if (typeof window === 'undefined') return;

  if (typeof BroadcastChannel !== 'undefined' && !broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel('pos_data_sync_channel');
      broadcastChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'DATA_CHANGED') {
          notifyListeners(true);
        }
      };
    } catch {
      broadcastChannel = null;
    }
  }

  setupRealtimeChannel();

  if (!pollTimer) {
    pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }
      notifyListeners();
    }, DEFAULT_POLL_INTERVAL_MS);
  }

  window.addEventListener('visibilitychange', handleVisibilityOrFocus);
  window.addEventListener('focus', handleVisibilityOrFocus);
  window.addEventListener('online', handleOnline);
  window.addEventListener('pos:data-change', handleCustomDataChange);
};

const stopSyncEngine = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  teardownRealtimeChannel();

  if (broadcastChannel) {
    try {
      broadcastChannel.close();
    } catch {
    }
    broadcastChannel = null;
  }

  if (typeof window !== 'undefined') {
    window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    window.removeEventListener('focus', handleVisibilityOrFocus);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('pos:data-change', handleCustomDataChange);
  }
};

export const subscribeToDataChanges = (listener: SyncListener): (() => void) => {
  listeners.add(listener);

  if (listeners.size === 1) {
    startSyncEngine();
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopSyncEngine();
    }
  };
};

export const triggerSync = () => {
  notifyListeners(true);
};
