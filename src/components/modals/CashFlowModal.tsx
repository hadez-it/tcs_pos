import React, { useState, useEffect } from 'react';
import { Wallet, AlertTriangle, CheckCircle, ArrowUpRight, ArrowDownLeft, Check } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CashFlowEntry, Branch, UserProfile } from '../../types';
import { dbService } from '../../lib/supabase';

interface CashFlowModalProps {
  user: UserProfile;
  editingCashFlow: CashFlowEntry | null;
  branches: Branch[];
  onClose: () => void;
  onSuccess: () => void;
}

const INCOME_CATEGORIES = ['POS Sales', 'Investment', 'Loan Received', 'Other Income'];
const EXPENSE_CATEGORIES = ['Inventory / Stock', 'Rent', 'Salaries', 'Utilities', 'Transport', 'Supplies', 'Marketing', 'Repairs', 'Other Expense'];

export default function CashFlowModal({
  user,
  editingCashFlow,
  branches,
  onClose,
  onSuccess
}: CashFlowModalProps) {
  const cashFlowSchema = z.object({
    type: z.enum(['income', 'expense']),
    title: z.string().min(1, 'Please enter a short title / description.'),
    amount: z.coerce.number().min(0.01, 'Please enter a valid amount greater than zero.'),
    category: z.string().min(1, 'Please select or enter a category.'),
    payment_method: z.enum(['cash', 'card', 'mobile', 'bank']),
    date: z.string().optional(),
    branch_id: z.string().optional(),
    notes: z.string().optional()
  });

  type CashFlowFormData = z.infer<typeof cashFlowSchema>;

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper to format ISO date string to datetime-local format
  const formatDateTimeLocal = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  };

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<CashFlowFormData>({
    resolver: zodResolver(cashFlowSchema),
    defaultValues: {
      type: editingCashFlow?.type || 'expense',
      title: editingCashFlow?.title || '',
      amount: editingCashFlow?.amount || 0,
      category: editingCashFlow?.category || '',
      payment_method: editingCashFlow?.payment_method || 'cash',
      date: formatDateTimeLocal(editingCashFlow?.created_at),
      branch_id: editingCashFlow?.branch_id || '',
      notes: editingCashFlow?.notes || ''
    }
  });

  const selectedType = watch('type');
  const selectedPaymentMethod = watch('payment_method');

  useEffect(() => {
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      const firstError = errors[errorKeys[0] as keyof CashFlowFormData]?.message;
      setFormError(firstError || 'Please fix the errors in the form.');
    } else {
      setFormError(null);
    }
  }, [errors]);

  const onSubmit = async (data: CashFlowFormData) => {
    setFormError(null);
    setFormSuccess(null);
    setIsSubmitting(true);

    const selectedBranch = branches.find(b => b.id === data.branch_id);
    const dateValue = data.date ? new Date(data.date).toISOString() : new Date().toISOString();

    try {
      const payload = {
        type: data.type,
        title: data.title.trim(),
        amount: data.amount,
        category: data.category.trim(),
        payment_method: data.payment_method,
        branch_id: data.branch_id || undefined,
        branch_name: selectedBranch ? selectedBranch.name : undefined,
        notes: data.notes?.trim() || undefined,
        performed_by: user.name,
        created_at: dateValue
      };

      if (editingCashFlow) {
        await dbService.cashFlow.update(editingCashFlow.id, payload);
        setFormSuccess('Cash flow entry updated successfully!');
      } else {
        await dbService.cashFlow.create(payload, user.name);
        setFormSuccess('Cash flow entry recorded successfully!');
      }

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Error saving cash flow entry:', err);
      setFormError(err.message || 'Failed to save cash flow entry.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-premium-xl border border-slate-100 max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scale-in">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/80">
          <h3 className="font-extrabold text-slate-900 flex items-center space-x-2 text-sm sm:text-base">
            <Wallet className="w-5 h-5 text-gray-900" />
            <span>{editingCashFlow ? 'Edit Cash Flow Entry' : 'Record Cash Flow Entry'}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 font-bold p-1 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden min-h-0 text-xs">
          <div className="p-5 overflow-y-auto space-y-5 flex-1">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 flex items-start space-x-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                <span>{formError}</span>
              </div>
            )}
            {formSuccess && (
              <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs text-gray-900 flex items-start space-x-1.5">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-gray-500" />
                <span>{formSuccess}</span>
              </div>
            )}

            {/* Type Toggle */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Transaction Type *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setValue('type', 'income')}
                  className={`py-2.5 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    selectedType === 'income'
                      ? 'border-gray-900 bg-gray-50 text-gray-900'
                      : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Income</span>
                </button>
                <button
                  type="button"
                  onClick={() => setValue('type', 'expense')}
                  className={`py-2.5 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    selectedType === 'expense'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>Expense</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Title / Description *</label>
                <input
                  type="text"
                  {...register('title')}
                  placeholder={selectedType === 'income' ? 'e.g. Shop rental income' : 'e.g. Monthly electricity bill'}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-gray-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Amount (Ks) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('amount')}
                  placeholder="0"
                  className={`w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold font-mono ${
                    selectedType === 'income' ? 'text-gray-900 focus:border-gray-900' : 'text-red-700 focus:border-red-500'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  {...register('date')}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-gray-900 font-mono text-[11px]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Category *</label>
                <input
                  type="text"
                  list="cf-category-options"
                  {...register('category')}
                  placeholder="Select or type a category..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-gray-900 font-medium"
                />
                <datalist id="cf-category-options">
                  {(selectedType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Payment Method</label>
                <div className="grid grid-cols-4 gap-1">
                  {(['cash', 'card', 'mobile', 'bank'] as const).map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setValue('payment_method', method)}
                      className={`py-2 rounded-lg border text-[9px] font-bold uppercase transition-all cursor-pointer ${
                        selectedPaymentMethod === method
                          ? 'border-gray-900 bg-gray-50 text-gray-900'
                          : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Branch</label>
                <select
                  {...register('branch_id')}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-gray-900 font-medium"
                >
                  <option value="">All / Head Office</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Notes</label>
                <textarea
                  rows={2}
                  {...register('notes')}
                  placeholder="Optional reference, receipt number, or extra detail..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-gray-900 font-medium resize-none"
                />
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50/60 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-800 text-white font-bold rounded-xl shadow-lg shadow-black/20 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{editingCashFlow ? 'Save Changes' : 'Save Entry'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
