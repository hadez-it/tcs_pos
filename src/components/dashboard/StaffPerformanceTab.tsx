import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Users, Filter, Calendar, Building2, ChevronDown, ChevronRight, 
  TrendingUp, TrendingDown, Award, ArrowUpDown, DollarSign, 
  Receipt, Package, User, Check, X, RotateCcw, BarChart3 
} from 'lucide-react';
import { formatCurrency, formatCompactCurrency } from '../../utils/format';
import { UserProfile, Branch, SaleWithItems } from '../../types';
import FilterDrawer from '../FilterDrawer';

export type PerformancePeriodPreset = 'today' | 'yesterday' | 'this-week' | 'this-month' | 'prev-month' | 'all' | 'custom';
export type PerformanceSortBy = 'revenue' | 'transactions' | 'items' | 'name';
export type PerformanceChartMetric = 'revenue' | 'transactions' | 'items';

interface StaffPerformanceTabProps {
  user: UserProfile;
  branches: Branch[];
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  perfDatePreset?: string;
  perfStartDate?: string;
  perfEndDate?: string;
  setPerfStartDate?: (date: string) => void;
  setPerfEndDate?: (date: string) => void;
  setPerfDatePreset?: (preset: string) => void;
  handlePerfMonthPreset?: (preset: any) => void;
  cashierPerformanceList?: any[];
  topCashierPerf?: any | null;
  totalCashierSalesVolume?: number;
  totalCashierTxCount?: number;
  setSelectedCashierForHistory: (data: { cashier: UserProfile; sales: SaleWithItems[] } | null) => void;
  startEditCashier?: (cashier: UserProfile) => void;
  sales?: SaleWithItems[];
  cashiers?: UserProfile[];
}

export default function StaffPerformanceTab({
  user,
  branches,
  selectedBranchId,
  setSelectedBranchId,
  perfDatePreset: externalPreset,
  perfStartDate: externalStartDate,
  perfEndDate: externalEndDate,
  setPerfStartDate: externalSetStartDate,
  setPerfEndDate: externalSetEndDate,
  setPerfDatePreset: externalSetPreset,
  handlePerfMonthPreset,
  cashierPerformanceList: externalList,
  topCashierPerf: externalTop,
  totalCashierSalesVolume: externalVolume,
  totalCashierTxCount: externalTxCount,
  setSelectedCashierForHistory,
  startEditCashier,
  sales = [],
  cashiers = []
}: StaffPerformanceTabProps) {
  const [periodPreset, setPeriodPreset] = useState<PerformancePeriodPreset>(() => {
    if (externalPreset === 'this-month' || externalPreset === 'prev-month' || externalPreset === 'all' || externalPreset === 'custom') {
      return externalPreset as PerformancePeriodPreset;
    }
    return 'this-month';
  });

  const [customStartDate, setCustomStartDate] = useState<string>(externalStartDate || '');
  const [customEndDate, setCustomEndDate] = useState<string>(externalEndDate || '');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [sortBy, setSortBy] = useState<PerformanceSortBy>('revenue');
  const [chartMetric, setChartMetric] = useState<PerformanceChartMetric>('revenue');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const periodMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (periodMenuRef.current && !periodMenuRef.current.contains(e.target as Node)) {
        setShowPeriodMenu(false);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatISODate = (d: Date): string => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const periodBounds = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDate = now.getDate();

    if (periodPreset === 'today') {
      const start = new Date(currentYear, currentMonth, currentDate, 0, 0, 0, 0);
      const end = new Date(currentYear, currentMonth, currentDate, 23, 59, 59, 999);
      const prevStart = new Date(currentYear, currentMonth, currentDate - 1, 0, 0, 0, 0);
      const prevEnd = new Date(currentYear, currentMonth, currentDate - 1, 23, 59, 59, 999);
      return { start, end, prevStart, prevEnd, label: `Today · ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` };
    }

    if (periodPreset === 'yesterday') {
      const start = new Date(currentYear, currentMonth, currentDate - 1, 0, 0, 0, 0);
      const end = new Date(currentYear, currentMonth, currentDate - 1, 23, 59, 59, 999);
      const prevStart = new Date(currentYear, currentMonth, currentDate - 2, 0, 0, 0, 0);
      const prevEnd = new Date(currentYear, currentMonth, currentDate - 2, 23, 59, 59, 999);
      return { start, end, prevStart, prevEnd, label: `Yesterday · ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` };
    }

    if (periodPreset === 'this-week') {
      const dayOfWeek = now.getDay();
      const distanceToMonday = (dayOfWeek + 6) % 7;
      const start = new Date(currentYear, currentMonth, currentDate - distanceToMonday, 0, 0, 0, 0);
      const end = new Date(currentYear, currentMonth, currentDate, 23, 59, 59, 999);
      const prevStart = new Date(start.getTime() - (7 * 24 * 60 * 60 * 1000));
      const prevEnd = new Date(start.getTime() - 1);
      return { start, end, prevStart, prevEnd, label: 'This Week' };
    }

    if (periodPreset === 'this-month') {
      const start = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
      const end = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
      const prevStart = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
      const prevEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
      return { start, end, prevStart, prevEnd, label: `This Month · ${now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` };
    }

    if (periodPreset === 'prev-month') {
      const start = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
      const end = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
      const prevStart = new Date(currentYear, currentMonth - 2, 1, 0, 0, 0, 0);
      const prevEnd = new Date(currentYear, currentMonth - 1, 0, 23, 59, 59, 999);
      return { start, end, prevStart, prevEnd, label: `Last Month · ${start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` };
    }

    if (periodPreset === 'custom' && customStartDate && customEndDate) {
      const start = new Date(`${customStartDate}T00:00:00`);
      const end = new Date(`${customEndDate}T23:59:59.999`);
      const span = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - span);
      const prevEnd = new Date(start.getTime() - 1);
      return { start, end, prevStart, prevEnd, label: `${customStartDate} – ${customEndDate}` };
    }

    return { start: null, end: null, prevStart: null, prevEnd: null, label: 'All Time' };
  }, [periodPreset, customStartDate, customEndDate]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (periodPreset !== 'this-month') count++;
    if (selectedBranchId !== 'all') count++;
    if (selectedStaffId !== 'all') count++;
    if (selectedRole !== 'all') count++;
    if (sortBy !== 'revenue') count++;
    return count;
  }, [periodPreset, selectedBranchId, selectedStaffId, selectedRole, sortBy]);

  const resetFilters = () => {
    setPeriodPreset('this-month');
    setCustomStartDate('');
    setCustomEndDate('');
    if (user.role !== 'manager') {
      setSelectedBranchId('all');
    }
    setSelectedStaffId('all');
    setSelectedRole('all');
    setSortBy('revenue');
    if (handlePerfMonthPreset) {
      handlePerfMonthPreset('this-month');
    }
  };

  const handleSelectPreset = (preset: PerformancePeriodPreset) => {
    setPeriodPreset(preset);
    setShowPeriodMenu(false);
    if (externalSetPreset) {
      if (preset === 'this-month' || preset === 'prev-month' || preset === 'all' || preset === 'custom') {
        externalSetPreset(preset);
      }
    }
    if (preset === 'custom') {
      if (!customStartDate) {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        setCustomStartDate(formatISODate(thirtyDaysAgo));
        setCustomEndDate(formatISODate(today));
      }
      setShowFilterDrawer(true);
    }
  };

  const currentPeriodSales = useMemo(() => {
    let list = sales;
    if (selectedBranchId !== 'all') {
      list = list.filter(s => s.branch_id === selectedBranchId);
    }
    if (periodBounds.start && periodBounds.end) {
      const startTime = periodBounds.start.getTime();
      const endTime = periodBounds.end.getTime();
      list = list.filter(s => {
        if (!s.created_at) return true;
        const time = new Date(s.created_at).getTime();
        return time >= startTime && time <= endTime;
      });
    }
    return list;
  }, [sales, selectedBranchId, periodBounds.start, periodBounds.end]);

  const prevPeriodSales = useMemo(() => {
    if (!periodBounds.prevStart || !periodBounds.prevEnd) return [];
    let list = sales;
    if (selectedBranchId !== 'all') {
      list = list.filter(s => s.branch_id === selectedBranchId);
    }
    const prevStartTime = periodBounds.prevStart.getTime();
    const prevEndTime = periodBounds.prevEnd.getTime();
    return list.filter(s => {
      if (!s.created_at) return false;
      const time = new Date(s.created_at).getTime();
      return time >= prevStartTime && time <= prevEndTime;
    });
  }, [sales, selectedBranchId, periodBounds.prevStart, periodBounds.prevEnd]);

  const candidateStaffList = useMemo(() => {
    let list = cashiers;
    if (selectedBranchId !== 'all') {
      list = list.filter(c => c.branch_id === selectedBranchId);
    }
    if (selectedRole !== 'all') {
      list = list.filter(c => c.role === selectedRole);
    } else {
      list = list.filter(c => c.role !== 'owner');
    }
    if (selectedStaffId !== 'all') {
      list = list.filter(c => c.id === selectedStaffId);
    }
    return list;
  }, [cashiers, selectedBranchId, selectedRole, selectedStaffId]);

  const performanceList = useMemo(() => {
    return candidateStaffList.map(cashier => {
      const cashierSales = currentPeriodSales.filter(s => 
        (s.cashier_id && s.cashier_id === cashier.id) ||
        (s.cashier_name && s.cashier_name.trim().toLowerCase() === cashier.name.trim().toLowerCase())
      );

      const totalRevenue = cashierSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const totalTransactions = cashierSales.length;
      const totalItemsSold = cashierSales.reduce((sum, s) => {
        return sum + (s.items ? s.items.reduce((iSum, item) => iSum + (item.quantity || 0), 0) : 0);
      }, 0);
      const sortedSales = [...cashierSales].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const lastActive = sortedSales.length > 0 ? sortedSales[0].created_at : null;

      return {
        cashier,
        totalRevenue,
        totalTransactions,
        totalItemsSold,
        lastActive,
        sales: sortedSales
      };
    }).sort((a, b) => {
      if (sortBy === 'revenue') {
        return b.totalRevenue - a.totalRevenue;
      }
      if (sortBy === 'transactions') {
        return b.totalTransactions - a.totalTransactions;
      }
      if (sortBy === 'items') {
        return b.totalItemsSold - a.totalItemsSold;
      }
      if (sortBy === 'name') {
        return a.cashier.name.localeCompare(b.cashier.name);
      }
      return b.totalRevenue - a.totalRevenue;
    });
  }, [candidateStaffList, currentPeriodSales, sortBy]);

  const totalRevenue = useMemo(() => {
    return performanceList.reduce((acc, c) => acc + c.totalRevenue, 0);
  }, [performanceList]);

  const totalTransactions = useMemo(() => {
    return performanceList.reduce((acc, c) => acc + c.totalTransactions, 0);
  }, [performanceList]);

  const prevPeriodTotalRevenue = useMemo(() => {
    return prevPeriodSales.reduce((acc, s) => acc + (s.total_amount || 0), 0);
  }, [prevPeriodSales]);

  const revenueTrend = useMemo(() => {
    if (periodPreset === 'all') {
      return { text: 'All-time total', isPositive: null, pct: null };
    }
    if (prevPeriodTotalRevenue === 0) {
      if (totalRevenue > 0) {
        return { text: '↑ 100% vs previous period', isPositive: true, pct: 100 };
      }
      return { text: 'No change vs previous period', isPositive: null, pct: 0 };
    }
    const diffPct = ((totalRevenue - prevPeriodTotalRevenue) / prevPeriodTotalRevenue) * 100;
    const absPct = Math.abs(Math.round(diffPct));
    if (diffPct > 0) {
      return { text: `↑ ${absPct}% vs previous period`, isPositive: true, pct: absPct };
    }
    if (diffPct < 0) {
      return { text: `↓ ${absPct}% vs previous period`, isPositive: false, pct: absPct };
    }
    return { text: '0% vs previous period', isPositive: null, pct: 0 };
  }, [periodPreset, totalRevenue, prevPeriodTotalRevenue]);

  const activeStaffCount = useMemo(() => {
    return performanceList.filter(p => p.totalTransactions > 0).length;
  }, [performanceList]);

  const topPerformer = useMemo(() => {
    const active = performanceList.filter(p => p.totalRevenue > 0);
    return active.length > 0 ? active[0] : null;
  }, [performanceList]);

  const maxChartValue = useMemo(() => {
    if (performanceList.length === 0) return 1;
    if (chartMetric === 'revenue') {
      const max = Math.max(...performanceList.map(p => p.totalRevenue), 0);
      return max > 0 ? max : 1;
    }
    if (chartMetric === 'transactions') {
      const max = Math.max(...performanceList.map(p => p.totalTransactions), 0);
      return max > 0 ? max : 1;
    }
    if (chartMetric === 'items') {
      const max = Math.max(...performanceList.map(p => p.totalItemsSold), 0);
      return max > 0 ? max : 1;
    }
    return 1;
  }, [performanceList, chartMetric]);

  const getInitials = (name?: string) => {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getBranchName = (branchId?: string) => {
    if (!branchId) return 'All Branches';
    const found = branches.find(b => b.id === branchId);
    return found ? found.name : 'Branch';
  };

  const formatChartMetricValue = (item: typeof performanceList[0]) => {
    if (chartMetric === 'revenue') {
      return formatCurrency(item.totalRevenue);
    }
    if (chartMetric === 'transactions') {
      return `${item.totalTransactions} ${item.totalTransactions === 1 ? 'receipt' : 'receipts'}`;
    }
    return `${item.totalItemsSold} units`;
  };

  const periodOptions: { id: PerformancePeriodPreset; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'this-week', label: 'This Week' },
    { id: 'this-month', label: 'This Month' },
    { id: 'prev-month', label: 'Last Month' },
    { id: 'all', label: 'All Time' },
    { id: 'custom', label: 'Custom Range...' }
  ];

  const sortOptions: { id: PerformanceSortBy; label: string }[] = [
    { id: 'revenue', label: 'Revenue' },
    { id: 'transactions', label: 'Receipts' },
    { id: 'items', label: 'Units Sold' },
    { id: 'name', label: 'Staff Name' }
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-black shrink-0" />
            <span>Staff Performance</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Track sales and performance metrics</p>
        </div>

        <div className="w-full sm:w-auto flex items-center gap-2">
          <div className="relative flex-1 sm:flex-none" ref={periodMenuRef}>
            <button
              type="button"
              onClick={() => setShowPeriodMenu(prev => !prev)}
              className="w-full sm:w-auto flex items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-900 transition-colors shadow-2xs cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="truncate max-w-[130px] sm:max-w-[160px]">
                {periodOptions.find(p => p.id === periodPreset)?.label || 'Period'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showPeriodMenu ? 'rotate-180' : ''}`} />
            </button>

            {showPeriodMenu && (
              <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  Select Period
                </div>
                {periodOptions.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectPreset(opt.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-left transition-colors cursor-pointer ${
                      periodPreset === opt.id ? 'bg-slate-100 text-black' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {periodPreset === opt.id && <Check className="w-3.5 h-3.5 text-black" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button 
            type="button"
            onClick={() => setShowFilterDrawer(true)}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs ${
              activeFilterCount > 0
                ? 'bg-black text-white border-black' 
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5 shrink-0" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-black text-[10px] font-black flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700">
          <Calendar className="w-3 h-3 text-slate-500" />
          <span>{periodBounds.label}</span>
        </div>

        {selectedBranchId !== 'all' && (
          <button
            type="button"
            onClick={() => setSelectedBranchId('all')}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-800 transition-colors cursor-pointer"
          >
            <Building2 className="w-3 h-3 text-slate-500" />
            <span>Branch: {getBranchName(selectedBranchId)}</span>
            <X className="w-3 h-3 text-slate-400 hover:text-slate-700 ml-0.5" />
          </button>
        )}

        {selectedStaffId !== 'all' && (
          <button
            type="button"
            onClick={() => setSelectedStaffId('all')}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-800 transition-colors cursor-pointer"
          >
            <User className="w-3 h-3 text-slate-500" />
            <span>Staff: {candidateStaffList.find(c => c.id === selectedStaffId)?.name || 'Selected'}</span>
            <X className="w-3 h-3 text-slate-400 hover:text-slate-700 ml-0.5" />
          </button>
        )}

        {selectedRole !== 'all' && (
          <button
            type="button"
            onClick={() => setSelectedRole('all')}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-800 transition-colors cursor-pointer"
          >
            <span className="capitalize">Role: {selectedRole}</span>
            <X className="w-3 h-3 text-slate-400 hover:text-slate-700 ml-0.5" />
          </button>
        )}

        {sortBy !== 'revenue' && (
          <button
            type="button"
            onClick={() => setSortBy('revenue')}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-800 transition-colors cursor-pointer"
          >
            <ArrowUpDown className="w-3 h-3 text-slate-500" />
            <span>Sort: {sortOptions.find(s => s.id === sortBy)?.label}</span>
            <X className="w-3 h-3 text-slate-400 hover:text-slate-700 ml-0.5" />
          </button>
        )}

        {activeFilterCount > 1 && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer ml-auto"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear filters</span>
          </button>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Overview</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Active Staff</span>
            <div className="mt-1">
              <div className="text-xl sm:text-2xl font-black text-black tracking-tight">
                {activeStaffCount}
              </div>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                of {candidateStaffList.length} staff
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Top Performer</span>
            <div className="mt-1">
              <div className="text-base sm:text-lg font-black text-black tracking-tight truncate">
                {topPerformer ? topPerformer.cashier.name : '—'}
              </div>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
                {topPerformer ? formatCurrency(topPerformer.totalRevenue) : 'No sales recorded'}
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Revenue</span>
            <div className="mt-1">
              <div className="text-lg sm:text-xl font-black text-black tracking-tight">
                {formatCurrency(totalRevenue)}
              </div>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5 flex items-center gap-1">
                {revenueTrend.isPositive === true && <TrendingUp className="w-3 h-3 text-slate-700" />}
                {revenueTrend.isPositive === false && <TrendingDown className="w-3 h-3 text-slate-700" />}
                <span className="truncate">{revenueTrend.text}</span>
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">POS Receipts</span>
            <div className="mt-1">
              <div className="text-xl sm:text-2xl font-black text-black tracking-tight">
                {totalTransactions}
              </div>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                {totalTransactions === 1 ? 'transaction' : 'transactions'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
          <div>
            <h3 className="text-sm font-extrabold text-gray-900 tracking-tight flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-black" />
              <span>
                {chartMetric === 'revenue' ? 'Revenue by Staff' : chartMetric === 'transactions' ? 'Receipts by Staff' : 'Units Sold by Staff'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">Visual comparison across active team members</p>
          </div>

          <div className="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setChartMetric('revenue')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartMetric === 'revenue' ? 'bg-black text-white shadow-2xs' : 'text-slate-600 hover:text-black'
              }`}
            >
              <DollarSign className="w-3 h-3" />
              <span>Revenue</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('transactions')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartMetric === 'transactions' ? 'bg-black text-white shadow-2xs' : 'text-slate-600 hover:text-black'
              }`}
            >
              <Receipt className="w-3 h-3" />
              <span>Receipts</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('items')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartMetric === 'items' ? 'bg-black text-white shadow-2xs' : 'text-slate-600 hover:text-black'
              }`}
            >
              <Package className="w-3 h-3" />
              <span>Units</span>
            </button>
          </div>
        </div>

        {performanceList.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No staff records available for the selected filters.
          </div>
        ) : (
          <div className="space-y-3">
            {performanceList.map((item) => {
              const metricVal = chartMetric === 'revenue' 
                ? item.totalRevenue 
                : chartMetric === 'transactions' 
                  ? item.totalTransactions 
                  : item.totalItemsSold;
              
              const pct = maxChartValue > 0 ? (metricVal / maxChartValue) * 100 : 0;
              const hasActivity = metricVal > 0;

              return (
                <div key={item.cashier.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <div className="w-5 h-5 rounded-full bg-slate-100 text-black text-[10px] font-black flex items-center justify-center shrink-0">
                        {getInitials(item.cashier.name)}
                      </div>
                      <span className="font-bold text-slate-900 truncate">{item.cashier.name}</span>
                      <span className="text-[10px] text-slate-400 truncate hidden sm:inline">
                        • {item.cashier.branch_name || getBranchName(item.cashier.branch_id)}
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 font-mono text-[11px] shrink-0">
                      {formatChartMetricValue(item)}
                    </span>
                  </div>

                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${hasActivity ? 'bg-black' : 'bg-slate-200'}`}
                      style={{ width: `${hasActivity ? Math.max(pct, 2) : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-extrabold text-gray-900 tracking-tight">Performance Ranking</h3>
            <p className="text-[11px] text-slate-500">Ranked by overall contribution and metrics</p>
          </div>

          <div className="relative" ref={sortMenuRef}>
            <button
              type="button"
              onClick={() => setShowSortMenu(prev => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-800 transition-colors shadow-2xs cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline text-slate-500 font-medium">Sort:</span>
              <span>{sortOptions.find(s => s.id === sortBy)?.label}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
            </button>

            {showSortMenu && (
              <div className="absolute right-0 mt-1.5 w-40 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  Sort Metric
                </div>
                {sortOptions.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSortBy(opt.id);
                      setShowSortMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-left transition-colors cursor-pointer ${
                      sortBy === opt.id ? 'bg-slate-100 text-black' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {sortBy === opt.id && <Check className="w-3.5 h-3.5 text-black" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {performanceList.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl text-center py-12 px-4 text-slate-400 text-xs flex flex-col items-center justify-center space-y-2.5">
            <Award className="w-8 h-8 text-slate-300" />
            <div>
              <p className="font-bold text-slate-700 text-sm">No Performance Records</p>
              <p className="text-slate-400 text-xs mt-0.5">No registered staff match the current filters.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {performanceList.map((item, idx) => {
              const isTop1 = idx === 0 && item.totalRevenue > 0;
              const hasActivity = item.totalTransactions > 0 || item.totalRevenue > 0;
              const rankNum = idx + 1;

              return (
                <div
                  key={item.cashier.id}
                  onClick={() => setSelectedCashierForHistory({ cashier: item.cashier, sales: item.sales })}
                  className={`bg-white border rounded-xl p-3 sm:p-3.5 transition-all flex items-center justify-between gap-3 cursor-pointer hover:border-black/40 hover:shadow-2xs ${
                    isTop1 ? 'border-black/30 bg-slate-50/40' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="shrink-0 flex items-center justify-center">
                      {rankNum === 1 ? (
                        <div className="w-6 h-6 rounded-lg bg-black text-white text-[11px] font-black flex items-center justify-center shadow-2xs">
                          #1
                        </div>
                      ) : rankNum === 2 ? (
                        <div className="w-6 h-6 rounded-lg bg-slate-800 text-white text-[11px] font-black flex items-center justify-center">
                          #2
                        </div>
                      ) : rankNum === 3 ? (
                        <div className="w-6 h-6 rounded-lg bg-slate-600 text-white text-[11px] font-black flex items-center justify-center">
                          #3
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold flex items-center justify-center">
                          #{rankNum}
                        </div>
                      )}
                    </div>

                    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-900 font-extrabold text-xs flex items-center justify-center shrink-0 border border-slate-200">
                      {getInitials(item.cashier.name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-extrabold text-slate-900 text-sm truncate leading-tight">
                          {item.cashier.name}
                        </h4>
                        {isTop1 && (
                          <span className="px-1.5 py-0.5 rounded bg-black text-white text-[9px] font-black uppercase tracking-wider">
                            Top Performer
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                        <span className="truncate">{item.cashier.branch_name || getBranchName(item.cashier.branch_id)}</span>
                        <span>•</span>
                        {hasActivity ? (
                          <span className="text-slate-600 font-medium truncate">
                            {item.totalTransactions} {item.totalTransactions === 1 ? 'receipt' : 'receipts'} · {item.totalItemsSold} units
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">
                            No sales activity
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="font-black text-slate-900 text-sm font-mono leading-tight">
                        {formatCurrency(item.totalRevenue)}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCashierForHistory({ cashier: item.cashier, sales: item.sales });
                        }}
                        className="text-[11px] font-bold text-slate-500 hover:text-black transition-colors flex items-center gap-0.5 ml-auto mt-0.5 cursor-pointer"
                      >
                        <span>View details</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FilterDrawer
        isOpen={showFilterDrawer}
        onClose={() => setShowFilterDrawer(false)}
        title="Staff Performance Filters"
        subtitle="Filter performance metrics by period, branch, and role"
        activeCount={activeFilterCount}
        onReset={resetFilters}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Time Period</label>
            <div className="grid grid-cols-3 gap-2">
              {periodOptions.filter(p => p.id !== 'custom').map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPeriodPreset(opt.id)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                    periodPreset === opt.id
                      ? 'bg-black text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Custom Date Range</label>
              {periodPreset === 'custom' && (
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-black text-white">Active</span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">From Date</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => {
                      setCustomStartDate(e.target.value);
                      setPeriodPreset('custom');
                      if (externalSetStartDate) externalSetStartDate(e.target.value);
                    }}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-black"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">To Date</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => {
                      setCustomEndDate(e.target.value);
                      setPeriodPreset('custom');
                      if (externalSetEndDate) externalSetEndDate(e.target.value);
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

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" /> Specific Staff Member
            </label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 font-medium text-slate-800 text-xs focus:outline-none focus:border-black focus:bg-white cursor-pointer"
            >
              <option value="all">All Staff Members</option>
              {cashiers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.branch_name || getBranchName(c.branch_id)})</option>
              ))}
            </select>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 font-medium text-slate-800 text-xs focus:outline-none focus:border-black focus:bg-white cursor-pointer"
            >
              <option value="all">All Roles (Cashiers & Managers)</option>
              <option value="cashier">Cashiers Only</option>
              <option value="manager">Managers Only</option>
            </select>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" /> Performance Metric / Sort
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as PerformanceSortBy)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 font-medium text-slate-800 text-xs focus:outline-none focus:border-black focus:bg-white cursor-pointer"
            >
              <option value="revenue">Revenue (Highest First)</option>
              <option value="transactions">POS Receipts (Most First)</option>
              <option value="items">Units Sold (Most First)</option>
              <option value="name">Staff Name (A to Z)</option>
            </select>
          </div>
        </div>
      </FilterDrawer>
    </div>
  );
}
