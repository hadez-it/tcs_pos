import React from 'react';
import { useBackDismiss } from '../lib/backNavigation';
import { useUiScale } from '../lib/uiScale';
import { SlidersHorizontal, X, Minus, Plus, RotateCcw, Check, ShoppingBag } from 'lucide-react';
import { formatCurrency } from '../utils/format';

interface UiSizeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UiSizeModal({ isOpen, onClose }: UiSizeModalProps) {
  useBackDismiss(isOpen, onClose);
  const { scale, setScale, resetScale, presets, minScale, maxScale, stepScale } = useUiScale();

  if (!isOpen) return null;

  const currentPercent = Math.round(scale * 100);

  const handleStep = (delta: number) => {
    const next = Math.round((scale + delta) * 100) / 100;
    if (next >= minScale && next <= maxScale) {
      setScale(next);
    }
  };

  return (
    <div className="bottom-sheet-overlay flex items-end sm:items-center justify-center p-0 sm:p-4 z-50" onClick={onClose}>
      <div
        className="bottom-sheet sm:!static sm:max-w-md w-full bg-white rounded-t-3xl sm:rounded-2xl shadow-premium-xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-3 pb-1 sm:hidden shrink-0">
          <div className="pull-indicator" />
        </div>

        <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-black text-white rounded-xl flex items-center justify-center shadow-xs">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 leading-tight">Display & UI Size</h3>
              <p className="text-[11px] text-slate-500 font-medium">Adjust screen scale for your device</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto android-scroll min-h-0">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
              Preset Sizes
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {presets.map((preset) => {
                const isActive = Math.abs(scale - preset.value) < 0.01;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setScale(preset.value)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isActive
                        ? 'bg-black text-white border-black shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold">{preset.label}</span>
                      {isActive && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <span className={`text-[10px] font-mono mt-1 ${isActive ? 'text-gray-300' : 'text-slate-500'}`}>
                      {Math.round(preset.value * 100)}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Fine Scale Adjustment
              </label>
              <span className="font-mono text-xs font-extrabold px-2.5 py-0.5 bg-black text-white rounded-full">
                {currentPercent}%
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleStep(-stepScale)}
                disabled={scale <= minScale}
                className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs active-scale"
                title="Decrease scale"
              >
                <Minus className="w-4 h-4" />
              </button>

              <input
                type="range"
                min={minScale}
                max={maxScale}
                step={stepScale}
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="flex-1 accent-black cursor-pointer"
              />

              <button
                type="button"
                onClick={() => handleStep(stepScale)}
                disabled={scale >= maxScale}
                className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs active-scale"
                title="Increase scale"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Live Preview
            </label>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                    <ShoppingBag className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-900 leading-tight">Sample Product Name</h5>
                    <p className="text-[10px] text-slate-500 font-mono">SKU-10294 • In Stock</p>
                  </div>
                </div>
                <span className="font-mono font-extrabold text-xs text-slate-900">
                  {formatCurrency(15000)}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 py-1.5 px-3 bg-black text-white rounded-xl text-xs font-bold shadow-xs pointer-events-none"
                >
                  Action Button
                </button>
                <span className="px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-[10px] font-bold">
                  Preview Card
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50 shrink-0 safe-area-bottom">
          <button
            type="button"
            onClick={resetScale}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active-scale"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset (100%)</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-initial px-5 py-2.5 bg-black hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active-scale"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
}
