import React from 'react';
import { Building2, Plus, Store, Edit2, Trash2, MapPin, Users, TrendingUp } from 'lucide-react';
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24 lg:pb-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-gray-950 to-slate-900 text-white p-5 sm:p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 text-gray-300 text-[10px] sm:text-xs font-bold border border-white/10 backdrop-blur-sm">
            <Building2 className="w-3.5 h-3.5" />
            <span>Stores & Branches</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black tracking-tight">Branch Management</h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
            Manage multiple store locations, track branch-specific performance, and organize your staff across different outlets.
          </p>
        </div>
        <button
          onClick={openNewBranchModal}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-white text-black font-extrabold rounded-xl text-sm hover:bg-gray-100 transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Branch</span>
        </button>
      </div>

      {branches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-16 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-100">
            <Store className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-lg font-black text-slate-900 mb-2">No Branches Yet</h3>
          <p className="text-sm text-slate-500 max-w-md mb-8 leading-relaxed">
            Create your first branch outlet to start tracking inventory and sales for specific locations.
          </p>
          <button
            onClick={openNewBranchModal}
            className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white font-bold rounded-xl text-sm hover:bg-slate-800 transition-colors shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Branch</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {branches.map((branch) => {
            const branchCashiersCount = cashiers.filter(c => c.branch_id === branch.id).length;
            const branchRevenue = sales
              .filter(s => s.branch_id === branch.id)
              .reduce((sum, s) => sum + s.total_amount, 0);

            return (
              <div key={branch.id} className="group flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-slate-300 transition-all duration-300 overflow-hidden relative">
                {/* Top accent line */}
                <div className={`h-1 w-full ${branch.is_active ? 'bg-black' : 'bg-slate-300'}`} />
                
                <div className="p-5 flex-1 flex flex-col">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-800 text-[10px] font-mono font-bold rounded-lg border border-slate-200/60 shadow-xs">
                        {branch.code}
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border shadow-xs ${
                        branch.is_active 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${branch.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-400'}`} />
                        <span>{branch.is_active ? 'Active' : 'Inactive'}</span>
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={() => startEditBranch(branch)}
                        className="p-2 text-slate-400 hover:text-black hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                        title="Edit Branch"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => triggerDeleteBranch(branch.id, branch.name)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                        title="Delete Branch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Main Info */}
                  <h4 className="font-extrabold text-slate-900 text-lg mb-4 line-clamp-1 group-hover:text-black transition-colors">{branch.name}</h4>
                  
                  <div className="space-y-2.5 text-xs text-slate-600 flex-1 mb-6">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 p-1 bg-slate-50 rounded-md border border-slate-100">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <span className="leading-snug line-clamp-2 mt-0.5 font-medium">{branch.address || 'No address provided'}</span>
                    </div>
                    
                    <div className="flex items-center gap-2.5">
                      <div className="p-1 bg-slate-50 rounded-md border border-slate-100">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <span className="font-mono font-medium">{branch.phone || 'No phone'}</span>
                    </div>

                    {branch.manager_name && (
                      <div className="flex items-center gap-2.5 mt-2 pt-2 border-t border-slate-100/60">
                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-[9px] border border-slate-200 shrink-0">
                          {branch.manager_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-slate-500">Manager: <strong className="text-slate-800">{branch.manager_name}</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metrics Footer */}
                <div className="grid grid-cols-2 bg-slate-50 border-t border-slate-100 divide-x divide-slate-100">
                  <div className="p-4 flex flex-col items-center text-center justify-center transition-colors hover:bg-slate-100/50">
                    <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider mb-1">Staff</span>
                    <span className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      {branchCashiersCount}
                    </span>
                  </div>
                  <div className="p-4 flex flex-col items-center text-center justify-center transition-colors hover:bg-slate-100/50">
                    <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider mb-1">Revenue</span>
                    <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
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
  );
}
