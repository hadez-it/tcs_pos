import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const iconMap: Record<ToastType, ReactNode> = {
    success: <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />,
    warning: <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />,
    info: <Info className="w-4 h-4 text-blue-500 shrink-0" />,
  };

  const styleMap: Record<ToastType, string> = {
    success: 'bg-emerald-50/95 border-emerald-200/80 text-emerald-800 shadow-lg shadow-emerald-500/10',
    error: 'bg-red-50/95 border-red-200/80 text-red-800 shadow-lg shadow-red-500/10',
    warning: 'bg-amber-50/95 border-amber-200/80 text-amber-800 shadow-lg shadow-amber-500/10',
    info: 'bg-blue-50/95 border-blue-200/80 text-blue-800 shadow-lg shadow-blue-500/10',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 p-3 rounded-xl border backdrop-blur-md animate-slide-down ${styleMap[t.type]}`}
          >
            {iconMap[t.type]}
            <span className="text-xs font-semibold flex-1 leading-relaxed">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="text-slate-400 hover:text-slate-600 shrink-0 p-0.5 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
