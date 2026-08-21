import React, { useState, useMemo } from 'react';
import { 
  Building2, Plus, Store, Edit2, Trash2, MapPin, 
  Users, TrendingUp, User, Phone, Search, X
} from 'lucide-react';
import { usePosStore } from '../../store/usePosStore';
import { formatCurrency } from '../../utils/format';
import { Branch } from '../../types';

interface BranchesTabProps {
  openNewBranchModal: () => void;
  startEditBranch: (branch: Branch) => void;
  triggerDeleteBranch: (id: string, name: string) => void;
}

export default function BranchesTab({
  openNewBranchModal,
  startEditBranch,
  triggerDeleteBranch
}: BranchesTabProps) {
  const { branches, cashiers, sales } = usePosStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const filteredBranches = useMemo(() => {
    return branches.filter((branch) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q || 
        branch.name.toLowerCase().includes(q) ||
        branch.code.toLowerCase().includes(q) ||
        (branch.address && branch.address.toLowerCase().includes(q)) ||
        (branch.manager_name && branch.manager_name.toLowerCase().includes(q)) ||
        (branch.phone && branch.phone.toLowerCase().includes(q));

      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'active' && branch.is_active) ||
        (statusFilter === 'inactive' && !branch.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [branches, searchQuery, statusFilter]);

  const totalActive = useMemo(() => branches.filter(b => b.is_active).length, [branches]);

  if (branches.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs w-full flex-1 flex flex-col items-center justify-center p-8 sm:p-14 text-center min-h-[380px] sm:min-h-[460px]">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3.5 border border-slate-200/70">
          <Store className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>
        <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
          No Branches Configured
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1.5 max-w-md leading-relaxed">
          Create your first branch outlet to start tracking inventory and sales across multiple store locations.
        </p>
        <button
          type="button"
          onClick={openNewBranchModal}
          className="mt-5 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-black hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Create First Branch</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden w-full max-w-full min-w-0 flex-1 flex flex-col">
      {/* Top Toolbar */}
      <div className="p-2.5 sm:p-3.5 border-b border-slate-200/90 bg-white space-y-2 shrink-0">
        {/* Row 1 — Full-width Search */}
        <div className="relative w-full">
          <Search className="absolute inset-y-0 left-0 pl-3 w-4 h-4 my-auto text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search branches..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 sm:py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-gray-900 shadow-2xs transition-colors"
            aria-label="Search branches"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Row 2 — Status Filter Pills */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200/70 shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({branches.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active ({totalActive})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                statusFilter === 'inactive'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inactive ({branches.length - totalActive})
            </button>
          </div>
        </div>
      </div>

      {/* Branch Cards Content */}
      <div className="flex-1 flex flex-col p-3 sm:p-4 bg-slate-50/50">
        {filteredBranches.length === 0 ? (
          <div className="text-center py-16 px-4 text-slate-500 text-xs flex flex-col items-center justify-center gap-2.5 flex-1 min-h-[260px]">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mb-1 border border-slate-200/60">
              <Search className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-slate-900 text-sm">No Matching Branches</h4>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              No branch outlets found matching your search or filters.
            </p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
              className="mt-2 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredBranches.map((branch) => {
              const branchCashiersCount = cashiers.filter(c => c.branch_id === branch.id).length;
              const branchRevenue = sales
                .filter(s => s.branch_id === branch.id)
                .reduce((sum, s) => sum + s.total_amount, 0);

              return (
                <div 
                  key={branch.id} 
                  onClick={() => startEditBranch(branch)}
                  className="group flex flex-col bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all duration-200 p-3 sm:p-3.5 gap-2.5 cursor-pointer active:scale-[0.99]"
                >
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-800 text-[10px] font-mono font-bold rounded-md border border-slate-200/80 shadow-2xs">
                        {branch.code}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1.5 border shadow-2xs ${
                        branch.is_active 
                          ? 'bg-slate-900 text-white border-slate-900' 
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${branch.is_active ? 'bg-white' : 'bg-slate-400'}`} />
                        <span>{branch.is_active ? 'Active' : 'Inactive'}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => startEditBranch(branch)}
                        className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-black hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Edit Branch"
                        aria-label={`Edit ${branch.name}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerDeleteBranch(branch.id, branch.name)}
                        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Branch"
                        aria-label={`Delete ${branch.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-950 text-sm leading-tight truncate group-hover:text-black">
                      {branch.name}
                    </h4>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600 min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {branch.address ? (
                        <span className="truncate font-medium text-slate-700 text-[11px]">{branch.address}</span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Location not set</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-600 min-w-0">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {branch.manager_name ? (
                        <span className="truncate font-medium text-slate-800 text-[11px]">
                          {branch.manager_name} <span className="text-[10px] text-slate-400 font-normal">(Manager)</span>
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 text-[11px]">No manager</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); startEditBranch(branch); }}
                            className="text-[10px] font-bold text-slate-700 hover:text-black underline cursor-pointer"
                          >
                            Assign
                          </button>
                        </div>
                      )}
                    </div>

                    {branch.phone && (
                      <div className="flex items-center gap-1.5 text-slate-600 min-w-0">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate font-mono font-medium text-slate-700 text-[11px]">{branch.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Staff:</span>
                      <span className="font-bold text-slate-900 font-mono text-[11px]">{branchCashiersCount}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Revenue:</span>
                      <span className="font-bold text-slate-900 font-mono text-[11px] truncate max-w-[120px]">
                        {formatCurrency(branchRevenue)}
                      </span>
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
