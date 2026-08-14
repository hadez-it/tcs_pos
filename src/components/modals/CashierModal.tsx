import React, { useState, useEffect } from 'react';
import { UserPlus, Edit2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Branch, UserProfile, UserRole } from '../../types';
import { dbService, formatEmailWithDefaultDomain } from '../../lib/supabase';

interface CashierModalProps {
  editingCashier: UserProfile | null;
  branches: Branch[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function CashierModal({
  editingCashier,
  branches,
  onClose,
  onSuccess
}: CashierModalProps) {
  const cashierSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().min(1, 'Username / Email is required'),
    password: editingCashier 
      ? z.string().optional()
      : z.string().min(6, 'Password must be at least 6 characters long'),
    branch_id: z.string().min(1, 'Branch assignment is required'),
    role: z.enum(['cashier', 'manager', 'owner'])
  });

  type CashierFormData = z.infer<typeof cashierSchema>;

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<CashierFormData>({
    resolver: zodResolver(cashierSchema),
    defaultValues: {
      name: editingCashier?.name || '',
      email: editingCashier?.email || '',
      password: '',
      branch_id: editingCashier?.branch_id || '',
      role: editingCashier?.role || 'cashier'
    }
  });

  useEffect(() => {
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      const firstError = errors[errorKeys[0] as keyof CashierFormData]?.message;
      setFormError(firstError || 'Please fix the errors in the form.');
    } else {
      setFormError(null);
    }
  }, [errors]);

  const onSubmit = async (data: CashierFormData) => {
    setFormError(null);
    setFormSuccess(null);
    setIsSubmitting(true);

    try {
      const assignedBranch = branches.find(b => b.id === data.branch_id);

      if (editingCashier) {
        const updates: Partial<UserProfile> = {
          name: data.name,
          email: formatEmailWithDefaultDomain(data.email),
          branch_id: data.branch_id || undefined,
          branch_name: assignedBranch ? assignedBranch.name : undefined,
          role: data.role
        };
        if (data.password) {
          updates.password = data.password;
        }
        await dbService.auth.updateCashier(editingCashier.id, updates);
        setFormSuccess('Staff credentials updated successfully!');
      } else {
        await dbService.auth.addCashier(
          formatEmailWithDefaultDomain(data.email), 
          data.name, 
          data.password!,
          data.branch_id || undefined,
          assignedBranch ? assignedBranch.name : undefined,
          data.role
        );
        setFormSuccess('Cashier registered successfully!');
      }

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Error saving cashier:', err);
      setFormError(err.message || 'Operation failed. Username may already exist.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-premium-xl border border-slate-100 max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-gray-50 rounded-lg text-gray-900">
              {editingCashier ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">{editingCashier ? 'Edit Cashier Account' : 'Register New Cashier'}</h3>
              <p className="text-[10px] text-slate-400">{editingCashier ? 'Update cashier login credentials' : 'Create login credentials for store staff'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 flex items-start space-x-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>{formError}</span>
            </div>
          )}
          {formSuccess && (
            <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-900 flex items-start space-x-1.5">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-gray-500" />
              <span>{formSuccess}</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Full Name</label>
            <input
              type="text"
              {...register('name')}
              placeholder="e.g. John Doe"
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-gray-900 font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Username</label>
            <div className="relative">
              <input
                type="text"
                {...register('email')}
                disabled={!!editingCashier}
                placeholder="e.g. cashier1"
                className={`w-full p-2.5 text-xs border rounded-lg focus:outline-none focus:border-gray-900 font-medium ${
                  editingCashier
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Password {editingCashier && <span className="text-slate-400 lowercase">(Leave empty to keep current)</span>}
            </label>
            <input
              type="password"
              {...register('password')}
              placeholder={editingCashier ? "Leave blank to keep current" : "Minimum 6 characters"}
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-gray-900 font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Assigned Branch Outlet</label>
            <select
              {...register('branch_id')}
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-gray-900 font-medium cursor-pointer"
            >
              <option value="" disabled>Select a Branch</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  📍 {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Account Role</label>
            <select
              {...register('role')}
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-gray-900 font-medium cursor-pointer"
            >
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
            </select>
          </div>

          <div className="p-3 bg-gray-50/60 border border-gray-100/80 rounded-lg text-[11px] text-gray-900 space-y-1">
            <p className="font-bold flex items-center gap-1 text-gray-900">
              <span>🔑 Staff Login Info</span>
            </p>
            <p className="text-[10px] text-gray-900/90">
              {editingCashier ? 'Update the staff login credentials.' : 'The staff will use their email and this custom password to log in.'}
            </p>
          </div>

          <div className="pt-3 flex justify-end space-x-2.5 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-black hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  {editingCashier ? <Edit2 className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>{editingCashier ? 'Save Account Changes' : 'Create Staff Account'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
