import React, { useState, useMemo } from 'react';
import { Award, Eye, Edit2, Filter, Users, Building2, Calendar } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { UserProfile, Branch, SaleWithItems } from '../../types';
import FilterDrawer from '../FilterDrawer';

interface StaffPerformanceTabProps {
  user: UserProfile;
  branches: Branch[];
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  perfDatePreset: string;
  perfStartDate: string;
  perfEndDate: string;
  setPerfStartDate: (date: string) => void;
  setPerfEndDate: (date: string) => void;
  setPerfDatePreset: (preset: string) => void;
  handlePerfMonthPreset: (preset: 'all' | 'prev-month' | 'this-month') => void;
  cashierPerformanceList: any[];
  topCashierPerf: any | null;
  totalCashierSalesVolume: number;
  totalCashierTxCount: number;
  setSelectedCashierForHistory: (data: { cashier: UserProfile; sales: SaleWithItems[] } | null) => void;
  startEditCashier: (cashier: UserProfile) => void;
}

export default function StaffPerformanceTab({
  user,
  branches,
  selectedBranchId,
  setSelectedBranchId,
  perfDatePreset,
  perfStartDate,
  perfEndDate,
  setPerfStartDate,
  setPerfEndDate,
  setPerfDatePreset,
  handlePerfMonthPreset,
  cashierPerformanceList,
  topCashierPerf,
  totalCashierSalesVolume,
  totalCashierTxCount,
  setSelectedCashierForHistory,
  startEditCashier
}: StaffPerformanceTabProps) {
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (perfDatePreset !== 'this-month') count++;
    if (selectedBranchId !== 'all') count++;
    return count;
  }, [perfDatePreset, selectedBranchId]);

  const resetFilters = () => {
    handlePerfMonthPreset('this-month');
    if (user.role !== 'manager') {
      setSelectedBranchId('all');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
            Staff Performance
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Track sales and performance metrics</p>
        </div>

        <button 
          onClick={() => setShowFilters(true)}
          className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeFilterCount > 0
              ? 'bg-black text-white border-black shadow-xs' 
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="w-4.5 h-4.5 rounded-full bg-white text-black text-[10px] font-black flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <FilterDrawer
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        title="Staff Performance Filters"
        subtitle="Filter performance metrics by period and branch"
        activeCount={activeFilterCount}
        onReset={resetFilters}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Time Period</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handlePerfMonthPreset('prev-month')}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                  perfDatePreset === 'prev-month'
                    ? 'bg-black text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Prev Month
              </button>
              <button
                onClick={() => handlePerfMonthPreset('this-month')}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                  perfDatePreset === 'this-month'
                    ? 'bg-black text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => handlePerfMonthPreset('all')}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                  perfDatePreset === 'all'
                    ? 'bg-black text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                All Time
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Custom Date Range</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">From Date</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={perfStartDate}
                    onChange={(e) => {
                      setPerfStartDate(e.target.value);
                      setPerfDatePreset('custom');
                    }}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-black"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">To Date</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={perfEndDate}
                    onChange={(e) => {
                      setPerfEndDate(e.target.value);
                      setPerfDatePreset('custom');
                    }}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-black"
                  />
                </div>
              </div>
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

      {/* Summary KPI Cards for Cashier Performance */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border-b-2 border-black p-4 flex flex-col justify-center">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Active Staff</span>
          <h3 className="text-xl sm:text-2xl font-black text-black mt-1">{cashierPerformanceList.length}</h3>
        </div>
        <div className="bg-white border-b-2 border-black p-4 flex flex-col justify-center">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Top Performer</span>
          <h3 className="text-sm sm:text-base font-black text-black mt-1 truncate">
            {topCashierPerf ? topCashierPerf.cashier.name : 'N/A'}
          </h3>
        </div>
        <div className="bg-white border-b-2 border-black p-4 flex flex-col justify-center">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Revenue</span>
          <h3 className="text-lg sm:text-xl font-black text-black mt-1">{formatCurrency(totalCashierSalesVolume)}</h3>
        </div>
        <div className="bg-white border-b-2 border-black p-4 flex flex-col justify-center">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">POS Receipts</span>
          <h3 className="text-xl sm:text-2xl font-black text-black mt-1">{totalCashierTxCount}</h3>
        </div>
      </div>

      {/* Minimalist List/Table View for Staff Performance */}
      {cashierPerformanceList.length === 0 ? (
        <div className="bg-white border border-slate-200 text-center py-16 text-slate-400 text-xs flex flex-col items-center justify-center space-y-3">
          <Award className="w-8 h-8 text-slate-300" />
          <div>
            <p className="font-bold text-slate-700 text-sm">No Performance Metrics Recorded</p>
            <p className="text-slate-400 text-xs mt-0.5">No registered staff or sales activity match the filters.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 flex flex-col">
          <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-1">Rank</div>
            <div className="col-span-3">Staff</div>
            <div className="col-span-2">Revenue</div>
            <div className="col-span-2">Receipts</div>
            <div className="col-span-2">Units Sold</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          <div className="divide-y divide-slate-100">
            {cashierPerformanceList.map((item, idx) => {
              const rankBadge = idx === 0 ? '🏆 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`;
              return (
                <div key={item.cashier.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="md:col-span-1 flex items-center justify-between md:justify-start">
                    <span className="bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {rankBadge}
                    </span>
                  </div>
                  <div className="md:col-span-3 flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 text-black font-black text-sm flex items-center justify-center shrink-0 rounded-full">
                      {item.cashier.name ? item.cashier.name.substring(0, 2).toUpperCase() : 'ST'}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-black text-sm truncate">{item.cashier.name}</h4>
                      <p className="text-[10px] text-slate-500 truncate">{item.cashier.branch_name || 'All Branches'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 md:contents">
                    <div className="md:col-span-2 flex flex-col">
                      <span className="md:hidden text-[9px] uppercase font-bold text-slate-400 mb-0.5">Revenue</span>
                      <span className="font-black text-black text-sm font-mono">{formatCurrency(item.totalRevenue)}</span>
                    </div>
                    <div className="md:col-span-2 flex flex-col">
                      <span className="md:hidden text-[9px] uppercase font-bold text-slate-400 mb-0.5">Receipts</span>
                      <span className="font-bold text-slate-800 text-sm">{item.totalTransactions}</span>
                    </div>
                    <div className="col-span-2 md:col-span-2 flex flex-col">
                      <span className="md:hidden text-[9px] uppercase font-bold text-slate-400 mb-0.5">Units Sold</span>
                      <span className="font-bold text-slate-800 text-sm">{item.totalItemsSold}</span>
                    </div>
                  </div>

                  <div className="md:col-span-2 flex items-center gap-2 md:justify-end mt-2 md:mt-0">
                    <button
                      onClick={() => setSelectedCashierForHistory({ cashier: item.cashier, sales: item.sales })}
                      className="flex-1 md:flex-none px-3 py-1.5 bg-black hover:bg-slate-800 text-white rounded text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="md:hidden lg:inline">View</span>
                    </button>
                    <button
                      onClick={() => startEditCashier(item.cashier)}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-black rounded text-xs font-bold transition-colors cursor-pointer flex items-center justify-center"
                      title="Edit Staff Account"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
