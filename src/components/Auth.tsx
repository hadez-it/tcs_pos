import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, AlertCircle, Eye, EyeOff, User } from 'lucide-react';
import { dbService, isSupabaseConfigured, formatEmailWithDefaultDomain } from '../lib/supabase';
import { UserProfile } from '../types';

interface AuthProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export default function Auth({ onLoginSuccess }: AuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Collapse the hero when the Android soft keyboard covers the viewport,
  // so the inputs and Sign in button stay reachable on short screens.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const baseline = vv.height;
    const handleResize = () => {
      setKeyboardOpen(vv.height < baseline * 0.75);
    };

    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (!email.trim() || !password.trim()) {
      setError('Please enter both your username and password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const user = await dbService.auth.login(formatEmailWithDefaultDomain(email), password);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 flex flex-col overflow-hidden">
      {/* Android status bar spacer */}
      <div className="safe-area-top" />

      {/* Compact brand hero — collapses while the keyboard is open */}
      <div
        className={`shrink-0 px-6 overflow-hidden transition-all duration-300 ease-out ${
          keyboardOpen ? 'max-h-0 opacity-0 pt-0 pb-0' : 'max-h-40 opacity-100 pt-7 pb-6'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 shrink-0 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/25 shadow-lg">
            <span className="font-black text-xl text-white leading-none">M</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-white tracking-tight leading-tight truncate">
              Mibayate POS
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full animate-pulse-soft ${
                  isSupabaseConfigured ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span className="text-[10px] font-bold text-indigo-100/80">
                {isSupabaseConfigured ? 'Connected to Cloud' : 'Offline Mode'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Form card — floats over the gradient, owns all remaining height */}
      <div className="flex-1 min-h-0 bg-white rounded-t-[28px] shadow-premium-xl flex flex-col animate-slide-up">
        <div className="flex-1 min-h-0 overflow-y-auto android-scroll px-6 pt-7 pb-6">
          <div className="mb-6">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Welcome back</h2>
            <p className="text-[13px] text-slate-500 mt-1 font-medium">Sign in to your dashboard</p>
          </div>

          {error && (
            <div className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200/80 text-red-700 flex items-start gap-2.5 text-xs animate-slide-down">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 pointer-events-none">
                  <User className="w-[18px] h-[18px]" />
                </span>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. cashier1"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="android-input w-full pl-11 pr-24 text-[15px] text-slate-900 placeholder-slate-400"
                />
                {email.trim() !== '' && !email.includes('@') && (
                  <span className="absolute inset-y-0 right-4 flex items-center text-[11px] text-slate-400 font-semibold pointer-events-none">
                    @pos.com
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 pointer-events-none">
                  <Lock className="w-[18px] h-[18px]" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="android-input w-full pl-11 pr-14 text-[15px] text-slate-900 placeholder-slate-400"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 px-4 flex items-center text-slate-400 active:text-slate-700 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2.5 py-4 px-6 bg-gradient-to-r from-indigo-600 to-indigo-700 active:from-indigo-800 active:to-indigo-900 text-white rounded-2xl font-bold text-[15px] shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-60 cursor-pointer active-scale mt-1"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>Sign in</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Bottom safe area */}
        <div className="safe-area-bottom bg-white" />
      </div>
    </div>
  );
}
