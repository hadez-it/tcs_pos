import React, { useState, useEffect } from 'react';
import { Building2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Branch } from '../../types';
import { dbService } from '../../lib/supabase';

interface BranchModalProps {
  editingBranch: Branch | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BranchModal({
  editingBranch,
  onClose,
  onSuccess
}: BranchModalProps) {
  const branchSchema = z.object({
    name: z.string().min(1, 'Branch name is required'),
    code: z.string().min(1, 'Branch code is required').max(10, 'Branch code too long'),
    address: z.string().min(1, 'Address is required'),
    phone: z.string().min(1, 'Phone number is required'),
    manager_name: z.string().optional()
  });

  type BranchFormData = z.infer<typeof branchSchema>;

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: editingBranch?.name || '',
      code: editingBranch?.code || '',
      address: editingBranch?.address || '',
      phone: editingBranch?.phone || '',
      manager_name: editingBranch?.manager_name || ''
    }
  });

  useEffect(() => {
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      const firstError = errors[errorKeys[0] as keyof BranchFormData]?.message;
      setFormError(firstError || 'Please fix the errors in the form.');
    } else {
      setFormError(null);
    }
  }, [errors]);

  const onSubmit = async (data: BranchFormData) => {
    setFormError(null);
    setFormSuccess(null);
    setIsSubmitting(true);

    try {
      if (editingBranch) {
        await dbService.branches.update(editingBranch.id, {
          name: data.name,
          code: data.code.toUpperCase(),
          address: data.address,
          phone: data.phone,
          manager_name: data.manager_name || undefined
        });
        setFormSuccess('Branch updated successfully!');
      } else {
        await dbService.branches.create({
          name: data.name,
          code: data.code.toUpperCase(),
          address: data.address,
          phone: data.phone,
          manager_name: data.manager_name || undefined,
          is_active: true
        });
        setFormSuccess('Branch created successfully!');
      }

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Error saving branch:', err);
      setFormError(err.message || 'Operation failed. Branch code may already exist.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-premium-xl border border-slate-100 max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-gray-50 rounded-lg text-gray-900">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">{editingBranch ? 'Edit Branch Outlet' : 'Register New Branch Outlet'}</h3>
              <p className="text-[10px] text-slate-400">Configure physical branch location & contact info</p>
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
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Branch Name</label>
            <input
              type="text"
              {...register('name')}
              placeholder="e.g. Mandalay City Mall Branch"
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-gray-900 font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Branch Code (Unique)</label>
            <input
              type="text"
              {...register('code')}
              placeholder="e.g. MDY-02"
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-gray-900 font-medium uppercase"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Physical Address</label>
            <textarea
              {...register('address')}
              rows={2}
              placeholder="Street address, Township, City"
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-gray-900 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Phone Number</label>
              <input
                type="text"
                {...register('phone')}
                placeholder="09-12345678"
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-gray-900 font-medium"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Manager Name (Opt)</label>
              <input
                type="text"
                {...register('manager_name')}
                placeholder="e.g. U Zaw Zaw"
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-gray-900 font-medium"
              />
            </div>
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
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{editingBranch ? 'Update Branch' : 'Register Branch'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
