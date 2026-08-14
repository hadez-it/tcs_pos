import React, { useState } from 'react';
import { Shield, Key, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { dbService } from '../lib/supabase';
import { UserProfile } from '../types';

interface ChangePasswordTabProps {
  user: UserProfile;
}

export default function ChangePasswordTab({ user }: ChangePasswordTabProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    try {
      setIsLoading(true);
      
      // Attempt to re-authenticate if we had currentPassword requirement?
      // Supabase updateUser doesn't strictly require current password for non-MFA, 
      // but if they want to be safe, they could. Here we just update.
      await dbService.auth.changePassword(newPassword);

      setSuccessMsg('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Password change error:', err);
      setErrorMsg(err.message || 'Failed to change password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-gray-950 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/20 text-gray-300 text-xs font-bold border border-gray-400/30">
            <Shield className="w-3.5 h-3.5" />
            <span>Account Security</span>
          </div>
          <h3 className="text-lg sm:text-xl font-extrabold tracking-tight">Change Password</h3>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Update your account password. Use a strong password to keep your store secure.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-xs font-bold flex items-center gap-2 shadow-xs animate-fade-in">
          <CheckCircle className="w-5 h-5 text-gray-900 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-bold flex items-center gap-2 shadow-xs animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
            <Key className="w-5 h-5 text-gray-900" />
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">Security Details</h4>
              <p className="text-[11px] text-slate-400">Enter your new desired password</p>
            </div>
          </div>

          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                New Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-black focus:border-black outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Confirm New Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-black focus:border-black outline-none transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 bg-black hover:bg-gray-900 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Update Password</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
