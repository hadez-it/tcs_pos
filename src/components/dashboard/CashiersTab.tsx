import React, { useState, useMemo } from 'react';
import { Search, Users, Building2, Edit2, Trash2, Filter, ShieldCheck } from 'lucide-react';
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
}

export default function CashiersTab({
  user,
  selectedBranchId,
  setSelectedBranchId,
  startEditCashier,
  triggerDeleteCashier
}: CashiersTabProps) {
  const { branches, cashiers } = usePosStore();
  const [cashierSearch, setCashierSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (cashierSearch.trim()) count++;
    if (roleFilter !== 'all') count++;
    if (selectedBranchId !== 'all') count++;
    return count;
  }, [cashierSearch, roleFilter, selectedBranchId]);

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

  return (
    <div className="space-y-6">
      {/* Header and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Staff Accounts</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">Manage {filteredCashiers.length} store managers and cashiers</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative max-w-xs w-full">
            <Search className="absolute inset-y-0 left-0 pl-3 w-4 h-4 my-auto text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search staff name or email..."
              value={cashierSearch}
              onChange={(e) => setCashierSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-gray-900 shadow-2xs transition-colors"
            />
          </div>

          <button
            onClick={() => setShowFilterDrawer(true)}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer shadow-2xs shrink-0 ${
              activeFilterCount > 0
                ? 'bg-black text-white border-black'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-4.5 h-4.5 rounded-full bg-white text-black text-[10px] font-black flex items-center justify-center">
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
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
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
                { val: 'all', label: 'All Roles' },
                { val: 'manager', label: 'Manager' },
                { val: 'cashier', label: 'Cashier' }
              ].map(opt => (
                <button
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
                <Building2 className="w-3.5 h-3.5 text-slate-400" /> Branch
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

      {/* Staff List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredCashiers.length === 0 ? (
          <div className="text-center py-20 px-4 text-slate-400 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-slate-300" />
            </div>
            <p className="font-bold text-slate-700 text-sm">No Staff Found</p>
            <p className="text-xs mt-1 max-w-xs">We couldn't find any staff accounts matching your search or filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredCashiers.map((cashier) => (
              <div key={cashier.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors group">
                
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 font-extrabold text-sm flex items-center justify-center uppercase shrink-0 shadow-xs border border-slate-200/60">
                    {cashier.name ? cashier.name.charAt(0) : 'S'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-slate-900 text-sm truncate">{cashier.name}</h4>
                      <span className={`px-2 py-0.5 rounded-md font-extrabold text-[9px] uppercase tracking-wider border ${
                        cashier.role === 'manager' 
                          ? 'bg-black text-white border-black' 
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {cashier.role || 'cashier'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{formatDisplayEmail(cashier.email)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:gap-6 text-xs shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="flex flex-col items-start sm:items-end gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned To</span>
                    <div className="flex items-center gap-1.5 font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{cashier.branch_name || 'All Branches'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEditCashier(cashier)}
                      className="p-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer shadow-xs active-scale"
                      title="Edit Account"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => triggerDeleteCashier(cashier.id, cashier.name)}
                      className="p-2.5 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-100 text-red-500 rounded-xl transition-all cursor-pointer shadow-xs active-scale"
                      title="Revoke Account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
