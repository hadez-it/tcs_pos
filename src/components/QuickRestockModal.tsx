import React, { useState, useEffect } from 'react';
import { X, Package, RefreshCw, AlertCircle, CheckCircle2, Minus, Plus } from 'lucide-react';
import { Product } from '../types';
import { formatCurrency } from '../utils/format';
import { useToast } from '../utils/toast';

interface QuickRestockModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onRestock: (productId: string, quantity: number) => Promise<void>;
}

export const QuickRestockModal: React.FC<QuickRestockModalProps> = ({
  product,
  isOpen,
  onClose,
  onRestock,
}) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setErrorMsg(null);
      setIsSaving(false);
    }
  }, [isOpen, product]);

  const newStock = product ? (product.stock || 0) + quantity : 0;
  const lowStockLevel = product?.min_stock_level || 0;

  const handleSave = async () => {
    if (!product || isSaving) return;
    if (!quantity || quantity <= 0) {
      setErrorMsg('Please enter a quantity greater than zero.');
      toast('Please enter a quantity greater than zero.', 'error');
      return;
    }
    setIsSaving(true);
    setErrorMsg(null);
    try {
      await onRestock(product.id, quantity);
      setIsSaving(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to restock product.');
      setIsSaving(false);
    }
  };

  if (!isOpen || !product) return null;

  const isLowAfter = newStock > 0 && newStock <= lowStockLevel;

  return (
    <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs transition-opacity animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        {/* HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex justify-between items-center bg-gradient-to-b from-emerald-50/60 to-white">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-sm shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base truncate">
                Restock Product
              </h3>
              <p className="text-[11px] text-slate-500 font-medium truncate">{product.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 space-y-4">
          {/* Current stock summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Current Stock</p>
              <p className="font-mono font-extrabold text-slate-900 text-xl mt-0.5">
                {product.stock} <span className="text-xs font-bold text-slate-400">{product.unit_name || 'ခု'}</span>
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
              <p className="text-[10px] text-emerald-600/70 uppercase font-bold tracking-wide">New Stock</p>
              <p className="font-mono font-extrabold text-emerald-700 text-xl mt-0.5">
                {newStock} <span className="text-xs font-bold text-emerald-500">{product.unit_name || 'ခု'}</span>
              </p>
            </div>
          </div>

          {/* Quantity stepper */}
          <div>
            <label className="text-xs font-extrabold text-slate-700 block mb-1.5">
              Add Quantity <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <button
                type="button"
                onClick={() => setQuantity(q => Math.max(0, q - 1))}
                className="p-3 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                className="flex-1 text-center py-2.5 font-mono font-extrabold text-lg text-slate-900 text focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setQuantity(q => q + 1)}
                className="p-3 text-slate-500 hover:bg-slate-100 transition-colors"
                aria-label="Increase quantity"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {isLowAfter && (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Great — this brings stock above the low-stock level ({lowStockLevel}).
            </div>
          )}
          {!isLowAfter && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-700 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Still at or below the low-stock level ({lowStockLevel}).
            </div>
          )}

          {errorMsg && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
          <span className="text-slate-500 font-medium">
            Unit Price: <strong className="text-slate-900 font-bold">{formatCurrency(product.price)}</strong>
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-800 font-bold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !quantity || quantity <= 0}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Package className="w-4 h-4" />
              )}
              <span>{isSaving ? 'Restocking...' : `Add ${quantity}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickRestockModal;