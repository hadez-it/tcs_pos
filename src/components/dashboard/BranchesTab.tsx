import React, { useState, useMemo } from 'react';
import { 
  Building2, Plus, Store, Edit2, Trash2, MapPin, 
  Users, TrendingUp, User, Phone, Search
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

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-16 lg:pb-6">
      <div className="bg-gradient-to-r from-slate-900 via-gray-950 to-slate-900 text-white px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl shadow-md border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-300" />
              <span>Branch Management</span>
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-300 text-[10px] font-bold border border-white/10">
              {branches.length} {branches.length === 1 ? 'Store' : 'Stores'}
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-snug">
            Configure outlets, manage locations, and monitor branch revenues.
          </p>
        </div>
        <button
          onClick={openNewBranchModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-slate-950 font-bold rounded-xl text-xs sm:text-sm hover:bg-slate-100 transition-all duration-200 shadow-sm active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Branch</span>
        </button>
      </div>

      {branches.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="relative flex-1">
            <Search className="absolute inset-y-0 left-0 pl-3 w-4 h-4 my-auto text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, code, city, manager..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1 shrink-0 overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              All ({branches.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Active ({totalActive})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                statusFilter === 'inactive'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Inactive ({branches.length - totalActive})
            </button>
          </div>
        </div>
      )}

      {branches.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-8 sm:p-12 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100 shadow-2xs">
            <Store className="w-7 h-7 text-slate-400" />
          </div>
          <h3 className="text-base font-black text-slate-900 mb-1">No Branches Configured</h3>
          <p className="text-xs text-slate-500 max-w-sm mb-5 leading-relaxed">
            Create your first branch outlet to start tracking inventory and sales across multiple store locations.
          </p>
          <button
            onClick={openNewBranchModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-black text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Branch</span>
          </button>
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-xs font-medium text-slate-500 mb-3">No branches match your search or filter.</p>
          <button
            onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
            className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredBranches.map((branch) => {
            const branchCashiersCount = cashiers.filter(c => c.branch_id === branch.id).length;
            const branchRevenue = sales
              .filter(s => s.branch_id === branch.id)
              .reduce((sum, s) => sum + s.total_amount, 0);

            return (
              <div 
                key={branch.id} 
                onClick={() => startEditBranch(branch)}
                className="group flex flex-col bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all duration-200 p-3.5 sm:p-4 gap-3 cursor-pointer active:scale-[0.99]"
              >
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-800 text-[10px] font-mono font-bold rounded-md border border-slate-200/80 shadow-2xs">
                      {branch.code}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1.5 border shadow-2xs ${
                      branch.is_active 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80' 
                        : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${branch.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      <span>{branch.is_active ? 'Active' : 'Inactive'}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => startEditBranch(branch)}
                      className="p-1.5 text-slate-500 hover:text-slate-950 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Edit Branch"
                      aria-label="Edit Branch"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => triggerDeleteBranch(branch.id, branch.name)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Branch"
                      aria-label="Delete Branch"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="font-black text-slate-950 text-sm sm:text-base leading-tight truncate group-hover:text-black">
                    {branch.name}
                  </h4>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-slate-600 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {branch.address ? (
                      <span className="truncate font-medium text-slate-700">{branch.address}</span>
                    ) : (
                      <span className="text-slate-400 font-normal">Location not set</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-slate-600 min-w-0">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {branch.manager_name ? (
                      <span className="truncate font-medium text-slate-800">
                        {branch.manager_name} <span className="text-[10px] text-slate-400 font-normal">(Manager)</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal">No manager assigned</span>
                    )}
                  </div>

                  {branch.phone && (
                    <div className="flex items-center gap-2 text-slate-600 min-w-0">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate font-mono font-medium text-slate-700 text-[11px]">{branch.phone}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100" />

                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Staff</span>
                    <span className="text-xs sm:text-sm font-black text-slate-950 flex items-center gap-1 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      {branchCashiersCount}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Revenue</span>
                    <span className="text-xs sm:text-sm font-black text-slate-950 flex items-center gap-1 mt-0.5 truncate">
                      <TrendingUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{formatCurrency(branchRevenue)}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
