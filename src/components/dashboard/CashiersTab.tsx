import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, Users, Building2, Edit2, Trash2, Filter, 
  ShieldCheck, Plus, MoreVertical, Copy, Check, X, Shield, UserCheck
} from 'lucide-react';
import { usePosStore } from '../../store/usePosStore';
import { formatDisplayEmail } from '../../utils/format';
import { UserProfile } from '../../types';
import FilterDrawer from '../FilterDrawer';

interface CashiersTabProps {
  user: UserProfile;
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  startEditCashier: (cashier: UserProfile) => void;
  triggerDeleteCashier: (id: string, name: string) => void;
  openNewCashierModal?: () => void;
}

export default function CashiersTab({
  user,
  selectedBranchId,
  setSelectedBranchId,
  startEditCashier,
  triggerDeleteCashier,
  openNewCashierModal
}: CashiersTabProps) {
  const { branches, cashiers } = usePosStore();
  const [cashierSearch, setCashierSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'manager' | 'cashier'>('all');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuId(null);
      }
    };
    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenuId]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (roleFilter !== 'all') count++;
    if (selectedBranchId !== 'all') count++;
    return count;
  }, [roleFilter, selectedBranchId]);

  const resetFilters = () => {
    setCashierSearch('');
    setRoleFilter('all');
    if (user.role !== 'manager') {
      setSelectedBranchId('all');
    }
  };

  const displayCashiers = useMemo(() => {
    return selectedBranchId === 'all'
      ? cashiers
      : cashiers.filter(c => c.branch_id === selectedBranchId);
  }, [cashiers, selectedBranchId]);

  const filteredCashiers = useMemo(() => {
    return displayCashiers.filter(c => {
      const q = cashierSearch.trim().toLowerCase();
      const matchesSearch = !q || (
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.branch_name && c.branch_name.toLowerCase().includes(q))
      );
      const matchesRole = roleFilter === 'all' || c.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [displayCashiers, cashierSearch, roleFilter]);

  const totalManagers = useMemo(() => {
    return displayCashiers.filter(c => c.role === 'manager').length;
  }, [displayCashiers]);

  const totalCashiers = useMemo(() => {
    return displayCashiers.filter(c => c.role !== 'manager').length;
  }, [displayCashiers]);

  const filteredManagers = useMemo(() => {
    return filteredCashiers.filter(c => c.role === 'manager').length;
  }, [filteredCashiers]);

  const filteredOnlyCashiers = useMemo(() => {
    return filteredCashiers.filter(c => c.role !== 'manager').length;
  }, [filteredCashiers]);

  const summarySubtitle = useMemo(() => {
    const isFiltered = cashierSearch.trim() !== '' || roleFilter !== 'all' || selectedBranchId !== 'all';
    if (isFiltered) {
      const mText = `${filteredManagers} ${filteredManagers === 1 ? 'manager' : 'managers'}`;
      const cText = `${filteredOnlyCashiers} ${filteredOnlyCashiers === 1 ? 'cashier' : 'cashiers'}`;
      return `Showing ${filteredCashiers.length} of ${displayCashiers.length} staff · ${mText} · ${cText}`;
    }
    const mText = `${totalManagers} ${totalManagers === 1 ? 'manager' : 'managers'}`;
    const cText = `${totalCashiers} ${totalCashiers === 1 ? 'cashier' : 'cashiers'}`;
    return `${displayCashiers.length} staff ${displayCashiers.length === 1 ? 'member' : 'members'} · ${mText} · ${cText}`;
  }, [cashierSearch, roleFilter, selectedBranchId, filteredCashiers.length, displayCashiers.length, filteredManagers, filteredOnlyCashiers, totalManagers, totalCashiers]);

  const getInitials = (name?: string) => {
    if (!name || !name.trim()) return 'S';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleCopyUsername = async (cashier: UserProfile) => {
    const username = formatDisplayEmail(cashier.email);
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(username);
      }
      setCopiedId(cashier.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setCopiedId(cashier.id);
      setTimeout(() => setCopiedId(null), 1800);
    }
    setOpenMenuId(null);
  };

  if (displayCashiers.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs w-full flex-1 flex flex-col items-center justify-center p-8 sm:p-14 text-center min-h-[380px] sm:min-h-[460px]">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3.5 border border-slate-200/70">
          <Users className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>
        <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">Staff Accounts</h3>
        <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 max-w-sm leading-relaxed">
          No staff members added yet. Use the <span className="font-bold text-slate-800">+</span> button in the top header to add your first manager or cashier account.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden w-full max-w-full min-w-0 flex-1 flex flex-col">
      {/* Top Toolbar */}
      <div className="p-2.5 sm:p-3.5 border-b border-slate-200/90 bg-white space-y-2 shrink-0">
        {/* Row 1: Full-width Search */}
        <div className="relative w-full">
          <Search className="absolute inset-y-0 left-0 pl-3 w-4 h-4 my-auto text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search staff..."
            value={cashierSearch}
            onChange={(e) => setCashierSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 sm:py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-gray-900 shadow-2xs transition-colors"
            aria-label="Search staff"
          />
          {cashierSearch && (
            <button
              type="button"
              onClick={() => setCashierSearch('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Row 2: Roles (Left) + Filter & Count (Right) */}
        <div className="flex items-center justify-between gap-2">
          {/* Left: Role Filter Pills */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200/70 shrink-0">
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                roleFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({displayCashiers.length})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('manager')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                roleFilter === 'manager'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Managers ({totalManagers})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('cashier')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                roleFilter === 'cashier'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cashiers ({totalCashiers})
            </button>
          </div>

          {/* Right: Filters Drawer Button */}
          <button
            type="button"
            onClick={() => setShowFilterDrawer(true)}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer shadow-2xs shrink-0 ${
              activeFilterCount > 0
                ? 'bg-black text-white border-black'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            aria-label="Filter staff"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-black text-[10px] font-black flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <FilterDrawer
        isOpen={showFilterDrawer}
        onClose={() => setShowFilterDrawer(false)}
        title="Staff Filters"
        subtitle="Filter accounts by branch and role"
        activeCount={activeFilterCount}
        onReset={resetFilters}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Search Query</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Name, email, or branch..."
                value={cashierSearch}
                onChange={(e) => setCashierSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-black focus:bg-white"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" /> Account Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 'all' as const, label: 'All Roles' },
                { val: 'manager' as const, label: 'Manager' },
                { val: 'cashier' as const, label: 'Cashier' }
              ].map(opt => (
                <button
                  type="button"
                  key={opt.val}
                  onClick={() => setRoleFilter(opt.val)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer text-center ${
                    roleFilter === opt.val
                      ? 'bg-black text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {user.role !== 'manager' && branches.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" /> Branch Location
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 font-medium text-slate-800 text-xs focus:outline-none focus:border-black focus:bg-white cursor-pointer"
              >
                <option value="all">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </FilterDrawer>

      <div className="flex-1 flex flex-col p-0 overflow-visible">
        {filteredCashiers.length === 0 ? (
          <div className="text-center py-16 px-4 text-slate-500 text-xs flex flex-col items-center justify-center gap-2.5 flex-1 min-h-[260px]">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mb-1 border border-slate-200/60">
              <Search className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-slate-900 text-sm">No Matching Staff Found</h4>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              We couldn't find any staff accounts matching your search or filters.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-2 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredCashiers.map((cashier) => {
              const isMenuOpen = openMenuId === cashier.id;
              const isCopied = copiedId === cashier.id;
              const roleDisplay = cashier.role || 'cashier';
              const isManager = roleDisplay === 'manager';

              return (
                <div
                  key={cashier.id}
                  className="px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200/80 text-slate-800 font-extrabold text-xs flex items-center justify-center shrink-0 tracking-tight select-none shadow-2xs">
                      {getInitials(cashier.name)}
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight truncate max-w-[180px] sm:max-w-[280px]"
                          title={cashier.name}
                        >
                          {cashier.name}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-extrabold text-[9px] uppercase tracking-wider border shrink-0 ${
                            isManager
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {isManager ? <Shield className="w-2.5 h-2.5" /> : <UserCheck className="w-2.5 h-2.5" />}
                          <span>{roleDisplay}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium truncate">
                        <span className="truncate" title={formatDisplayEmail(cashier.email)}>
                          @{formatDisplayEmail(cashier.email)}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="truncate flex items-center gap-1 text-[10px]" title={cashier.branch_name || 'All Branches'}>
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          {cashier.branch_name || 'All Branches'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 relative">
                    <button
                      type="button"
                      onClick={() => startEditCashier(cashier)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer active:scale-95"
                      title="Edit Staff Account"
                      aria-label={`Edit ${cashier.name}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(isMenuOpen ? null : cashier.id)}
                        className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-colors shadow-2xs cursor-pointer active:scale-95 ${
                          isMenuOpen
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
                        }`}
                        title="More Actions"
                        aria-label={`More options for ${cashier.name}`}
                        aria-expanded={isMenuOpen}
                        aria-haspopup="menu"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {isMenuOpen && (
                        <div
                          ref={menuRef}
                          className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1 z-40 animate-scale-in"
                          role="menu"
                        >
                          <button
                            type="button"
                            onClick={() => handleCopyUsername(cashier)}
                            className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                            role="menuitem"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-slate-900" />
                                <span className="text-slate-900 font-bold">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                                <span>Copy Username</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              startEditCashier(cashier);
                            }}
                            className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                            role="menuitem"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>Edit Account</span>
                          </button>

                          <div className="my-1 border-t border-slate-100" />

                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              triggerDeleteCashier(cashier.id, cashier.name);
                            }}
                            className="w-full px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"
                            role="menuitem"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            <span>Revoke Access</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
