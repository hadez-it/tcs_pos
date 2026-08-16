import React, { useState, useMemo } from 'react';
import { 
  ChevronDown, ChevronUp, Download, Plus, ArrowUpRight, 
  ArrowDownLeft, Wallet, TrendingUp, TrendingDown, Banknote, Edit2, Trash2 
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, CartesianGrid, 
  XAxis, YAxis, Tooltip, Legend, Line 
} from 'recharts';
import { formatCurrency } from '../../utils/format';
import { UserProfile, Branch, CashFlowEntry, Sale, CashFlowType } from '../../types';

interface CashFlowTabProps {
  user: UserProfile;
  branches: Branch[];
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  cashFlowEntries: CashFlowEntry[];
  displaySales: Sale[];
  openNewCashFlowModal: () => void;
  startEditCashFlow: (entry: CashFlowEntry) => void;
  triggerDeleteCashFlow: (entry: CashFlowEntry) => void;
}

export default function CashFlowTab({
  user,
  branches,
  selectedBranchId,
  setSelectedBranchId,
  cashFlowEntries,
  displaySales,
  openNewCashFlowModal,
  startEditCashFlow,
  triggerDeleteCashFlow
}: CashFlowTabProps) {
  const [cfRange, setCfRange] = useState<'today' | 'this_week' | 'this_month' | 'last_month' | 'custom'>('this_month');
  const [cfTypeFilter, setCfTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [cfStartDate, setCfStartDate] = useState('');
  const [cfEndDate, setCfEndDate] = useState('');
  const [cfSearch, setCfSearch] = useState('');
  const [cfCategoryFilter, setCfCategoryFilter] = useState('All');
  const [showCfFilters, setShowCfFilters] = useState(false);
  const [isCfExporting, setIsCfExporting] = useState(false);

  const isWithinCfRange = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    switch (cfRange) {
      case 'today':
        return d.toDateString() === now.toDateString();
      case 'this_week': {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0,0,0,0);
        return d >= startOfWeek && d <= now;
      }
      case 'this_month':
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      case 'last_month': {
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return d.getFullYear() === year && d.getMonth() === lastMonth;
      }
      case 'custom': {
        if (!cfStartDate || !cfEndDate) return true;
        const dateOnly = dateStr.slice(0, 10);
        return dateOnly >= cfStartDate && dateOnly <= cfEndDate;
      }
      default:
        return true;
    }
  };

  const cashFlowAnalytics = useMemo(() => {
    const manual = cashFlowEntries.filter(e => isWithinCfRange(e.created_at));
    const manualIn = manual.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const manualOut = manual.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);

    const inRangeSales = displaySales.filter(s => isWithinCfRange(s.created_at));
    const salesIn = inRangeSales.reduce((s, sale) => s + sale.total_amount, 0);

    const today = new Date().toISOString().slice(0, 10);
    const todayManualIn = manual.filter(e => e.type === 'income' && e.created_at.startsWith(today)).reduce((s, e) => s + e.amount, 0);
    const todayManualOut = manual.filter(e => e.type === 'expense' && e.created_at.startsWith(today)).reduce((s, e) => s + e.amount, 0);
    const todaySales = inRangeSales.filter(s => s.created_at.startsWith(today));
    const todaySalesIn = todaySales.reduce((s, sale) => s + sale.total_amount, 0);

    const cashIn = manualIn + salesIn;
    const cashOut = manualOut;
    const todayIn = todayManualIn + todaySalesIn;
    const todayOut = todayManualOut;

    return {
      cashIn: Number(cashIn.toFixed(2)),
      cashOut: Number(cashOut.toFixed(2)),
      net: Number((cashIn - cashOut).toFixed(2)),
      todayNet: Number((todayIn - todayOut).toFixed(2)),
      manualCount: manual.length,
      saleCount: inRangeSales.length
    };
  }, [cashFlowEntries, displaySales, cfRange, cfStartDate, cfEndDate]);

  const cashFlowDaily = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const now = new Date();
    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let startDate = nowStart;
    let endDate = nowStart;
    
    if (cfRange === 'today') {
      startDate = nowStart;
      endDate = nowStart;
    } else if (cfRange === 'this_week') {
      const day = now.getDay();
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day).getTime();
      endDate = nowStart;
    } else if (cfRange === 'this_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime();
    } else if (cfRange === 'last_month') {
      const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      startDate = new Date(year, lastMonth, 1).getTime();
      endDate = new Date(year, lastMonth + 1, 0).getTime();
    } else if (cfRange === 'custom' && cfStartDate && cfEndDate) {
      startDate = new Date(cfStartDate).getTime();
      endDate = new Date(cfEndDate).getTime();
    } else {
      const allDates = [...cashFlowEntries.map(e => e.created_at), ...displaySales.map(s => s.created_at)];
      let earliest = nowStart;
      allDates.forEach(d => {
        const t = new Date(d.slice(0, 10)).getTime();
        if (t < earliest) earliest = t;
      });
      startDate = earliest;
      endDate = nowStart;
    }

    const map: { [day: string]: { inflow: number; outflow: number; net: number } } = {};
    const currentDate = new Date(startDate);
    while (currentDate.getTime() <= endDate) {
      const yyyy = currentDate.getFullYear();
      const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
      const dd = String(currentDate.getDate()).padStart(2, '0');
      map[`${yyyy}-${mm}-${dd}`] = { inflow: 0, outflow: 0, net: 0 };
      currentDate.setDate(currentDate.getDate() + 1);
    }

    cashFlowEntries.forEach(e => {
      const day = e.created_at.slice(0, 10);
      if (!map[day]) return;
      if (e.type === 'income') map[day].inflow += e.amount;
      else map[day].outflow += e.amount;
    });

    displaySales.forEach(sale => {
      const day = sale.created_at.slice(0, 10);
      if (!map[day]) return;
      map[day].inflow += sale.total_amount;
    });

    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, v]) => ({
        date: new Date(day + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        inflow: Number(v.inflow.toFixed(2)),
        outflow: Number(v.outflow.toFixed(2)),
        net: Number((v.inflow - v.outflow).toFixed(2))
      }));
  }, [cashFlowEntries, displaySales, cfRange, cfStartDate, cfEndDate]);

  const cfCategoryBreakdown = useMemo(() => {
    const income: { [cat: string]: number } = {};
    const expense: { [cat: string]: number } = {};

    cashFlowEntries.filter(e => isWithinCfRange(e.created_at)).forEach(e => {
      const target = e.type === 'income' ? income : expense;
      target[e.category] = (target[e.category] || 0) + e.amount;
    });

    displaySales.filter(s => isWithinCfRange(s.created_at)).forEach(sale => {
      income['POS Sales'] = (income['POS Sales'] || 0) + sale.total_amount;
    });

    return {
      income: Object.entries(income).map(([category, value]) => ({ category, value: Number(value.toFixed(2)) })).sort((a, b) => b.value - a.value),
      expense: Object.entries(expense).map(([category, value]) => ({ category, value: Number(value.toFixed(2)) })).sort((a, b) => b.value - a.value)
    };
  }, [cashFlowEntries, displaySales, cfRange, cfStartDate, cfEndDate]);

  const cashFlowLedger = useMemo(() => {
    type LedgerRow = {
      key: string;
      type: CashFlowType;
      category: string;
      title: string;
      amount: number;
      payment_method: string;
      branch_name?: string;
      notes?: string;
      performed_by: string;
      created_at: string;
      source: 'manual' | 'sale';
    };

    const rows: LedgerRow[] = [];

    cashFlowEntries.forEach(e => {
      if (!isWithinCfRange(e.created_at)) return;
      if (selectedBranchId !== 'all' && e.branch_id !== selectedBranchId) return;
      if (cfTypeFilter !== 'all' && e.type !== cfTypeFilter) return;
      if (cfCategoryFilter !== 'All' && e.category !== cfCategoryFilter) return;

      const q = cfSearch.trim().toLowerCase();
      if (q && !(e.title.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) || (e.notes || '').toLowerCase().includes(q))) return;

      rows.push({
        key: e.id,
        type: e.type,
        category: e.category,
        title: e.title,
        amount: e.amount,
        payment_method: e.payment_method,
        branch_name: e.branch_name,
        notes: e.notes,
        performed_by: e.performed_by,
        created_at: e.created_at,
        source: 'manual'
      });
    });

    displaySales.forEach(sale => {
      if (!isWithinCfRange(sale.created_at)) return;
      const matchType = (t: CashFlowType) => cfTypeFilter === 'all' || cfTypeFilter === t;
      const matchCat = (c: string) => cfCategoryFilter === 'All' || cfCategoryFilter === c;

      if (matchType('income') && matchCat('POS Sales')) {
        rows.push({
          key: `${sale.id}-in`,
          type: 'income',
          category: 'POS Sales',
          title: `POS Sale ${sale.id.replace('sale-', '#').slice(0, 10)}`,
          amount: sale.total_amount,
          payment_method: sale.payment_method,
          branch_name: sale.branch_name,
          notes: `Checked out by ${sale.cashier_name}${sale.customer_name ? ` for ${sale.customer_name}` : ''}`,
          performed_by: sale.cashier_name,
          created_at: sale.created_at,
          source: 'sale'
        });
      }
    });

    return rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [cashFlowEntries, displaySales, selectedBranchId, cfRange, cfTypeFilter, cfCategoryFilter, cfSearch, cfStartDate, cfEndDate]);

  const handleExportCashFlowCsv = () => {
    setIsCfExporting(true);
    try {
      const headers = ['Date', 'Type', 'Category', 'Title', 'Amount', 'Payment Method', 'Branch', 'Recorded By', 'Notes'];
      const rows = cashFlowLedger.map(r => [
        new Date(r.created_at).toISOString(),
        r.type,
        `"${(r.category || '').replace(/"/g, '""')}"`,
        `"${(r.title || '').replace(/"/g, '""')}"`,
        r.amount,
        r.payment_method,
        `"${(r.branch_name || '').replace(/"/g, '""')}"`,
        `"${(r.performed_by || '').replace(/"/g, '""')}"`,
        `"${(r.notes || '').replace(/"/g, '""')}"`
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `cash_flow_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export CSV', err);
    } finally {
      setIsCfExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Control / Filters Row */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-premium space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCfFilters(!showCfFilters)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] sm:text-xs rounded-xl border border-slate-200 transition-all cursor-pointer active:scale-95 shadow-2xs"
              title={showCfFilters ? 'Hide filters' : 'Show filters'}
            >
              {showCfFilters ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 shrink-0" />
                  <span>Hide Filters</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 shrink-0" />
                  <span>Show Filters</span>
                </>
              )}
            </button>
            <button
              onClick={handleExportCashFlowCsv}
              disabled={isCfExporting || cashFlowLedger.length === 0}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] sm:text-xs rounded-xl border border-slate-200 transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
              title="Export the filtered cash flow report to CSV"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 shrink-0" />
              <span className="truncate">Export CSV</span>
            </button>
            <button
              onClick={openNewCashFlowModal}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-800 text-white font-bold text-[11px] sm:text-xs rounded-xl shadow-lg shadow-black/20 transition-all cursor-pointer active:scale-95"
              title="Add a new income or expense entry"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">Add Entry</span>
            </button>
          </div>
        </div>

        {/* Filters with smooth animation */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            maxHeight: showCfFilters ? '500px' : '0',
            opacity: showCfFilters ? 1 : 0,
            marginTop: showCfFilters ? 0 : '-8px',
          }}
        >
          {/* Date Range Segmented Control */}
          <div className="flex flex-col gap-2">
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Period</span>
              <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
                {([
                  ['last_month', 'Last Month'],
                  ['today', 'Today'],
                  ['this_week', 'This Week'],
                  ['this_month', 'This Month'],
                  ['custom', 'Custom']
                ] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setCfRange(val)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      cfRange === val
                        ? 'bg-white text-gray-900 shadow-2xs border border-slate-200'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {cfRange === 'custom' && (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">From</span>
                  <input
                    type="date"
                    value={cfStartDate}
                    onChange={e => setCfStartDate(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-gray-900"
                  />
                </div>
                <div className="flex-1 flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">To</span>
                  <input
                    type="date"
                    value={cfEndDate}
                    onChange={e => setCfEndDate(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-gray-900"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Type Filter */}
          <div>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Flow Type</span>
            <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
              {([
                ['all', 'All'],
                ['income', 'Income'],
                ['expense', 'Expense']
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setCfTypeFilter(val)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    cfTypeFilter === val
                      ? 'bg-white text-gray-900 shadow-2xs border border-slate-200'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Category</span>
            <select
              value={cfCategoryFilter}
              onChange={(e) => setCfCategoryFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl py-2 px-2.5 font-medium text-slate-800 text-xs focus:outline-none shadow-2xs"
            >
              {['All', ...Array.from(new Set([...cfCategoryBreakdown.income, ...cfCategoryBreakdown.expense].map(c => c.category)))]
                .map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          {/* Branch */}
          {user.role !== 'manager' && branches.length > 0 && (
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Branch</span>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-2.5 font-medium text-slate-800 text-xs focus:outline-none shadow-2xs cursor-pointer"
              >
                <option value="all">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Search */}
          <div>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Search</span>
            <div className="relative">
              <input
                type="text"
                placeholder="Title, category, notes..."
                value={cfSearch}
                onChange={(e) => setCfSearch(e.target.value)}
                className="w-full pl-3 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-gray-900 shadow-2xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {[
          { label: 'Cash Inflow', value: formatCurrency(cashFlowAnalytics.cashIn), icon: ArrowUpRight, color: 'emerald', sub: `${cashFlowAnalytics.saleCount} POS sales auto-tracked` },
          { label: 'Cash Outflow', value: formatCurrency(cashFlowAnalytics.cashOut), icon: ArrowDownLeft, color: 'red', sub: `${cashFlowAnalytics.manualCount} manual records` },
          { label: 'Net Cash Flow', value: formatCurrency(cashFlowAnalytics.net), icon: Wallet, color: cashFlowAnalytics.net >= 0 ? 'emerald' : 'red', sub: 'Inflow − Outflow' },
          { label: "Today's Net", value: formatCurrency(cashFlowAnalytics.todayNet), icon: cashFlowAnalytics.todayNet >= 0 ? TrendingUp : TrendingDown, color: cashFlowAnalytics.todayNet >= 0 ? 'emerald' : 'red', sub: 'Cash balance today' }
        ].map((card, i) => (
          <div key={i} className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-premium flex items-center justify-between card-hover">
            <div className="min-w-0">
              <span className="text-slate-400 text-[9px] sm:text-[10px] uppercase tracking-wider font-bold block truncate">{card.label}</span>
              <h3 className={`text-sm sm:text-lg md:text-xl font-extrabold mt-1 truncate ${
                card.color === 'emerald' ? 'text-gray-900' :
                card.color === 'red' ? 'text-red-600' :
                'text-slate-900'
              }`}>
                {card.value}
              </h3>
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium mt-1 truncate">{card.sub}</p>
            </div>
            <div className={`p-2 sm:p-3 rounded-xl shrink-0 ml-1 shadow-sm ${
              card.color === 'emerald' ? 'bg-gray-50 text-gray-900' :
              card.color === 'red' ? 'bg-red-50 text-red-600' :
              'bg-slate-100 text-slate-500'
            }`}>
              <card.icon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Daily Cash Flow Trend Chart */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
        <p className="text-[10px] text-slate-400 mb-4">Daily inflow, outflow, and net cash position</p>
        <div className="w-full h-64 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cashFlowDaily} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                minTickGap={18}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-800">
                        <p className="font-bold text-slate-300 text-[11px] border-b border-slate-800 pb-1 mb-1">
                          {label}
                        </p>
                        {payload.map((entry: any, index: number) => (
                          <div key={index} className="flex items-center justify-between gap-4 font-semibold">
                            <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                              {entry.name}:
                            </span>
                            <span className="text-white font-mono font-bold">
                              {formatCurrency(Number(entry.value))}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '11px', fontWeight: 'bold' }}
              />
              <Line
                type="monotone"
                dataKey="inflow"
                name="Cash Inflow"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#10b981', stroke: '#ffffff', strokeWidth: 1 }}
                activeDot={{ r: 6, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="outflow"
                name="Cash Outflow"
                stroke="#ef4444"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#ef4444', stroke: '#ffffff', strokeWidth: 1 }}
                activeDot={{ r: 6, fill: '#ef4444', stroke: '#ffffff', strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="net"
                name="Net Cash Flow"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#6366f1', stroke: '#ffffff', strokeWidth: 1 }}
                activeDot={{ r: 6, fill: '#6366f1', stroke: '#ffffff', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="grid lg:grid-cols-2 gap-6">
        {[
          { title: 'Income by Category', type: 'income', items: cfCategoryBreakdown.income, accent: 'emerald' },
          { title: 'Expense by Category', type: 'expense', items: cfCategoryBreakdown.expense, accent: 'red' }
        ].map((block, idx) => {
          const total = block.items.reduce((s, c) => s + c.value, 0);
          const maxVal = block.items.reduce((m, c) => Math.max(m, c.value), 1);
          return (
            <div key={idx} className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
              <h4 className="font-bold text-sm text-slate-800 mb-5 flex items-center gap-2">
                {block.type === 'income' ? <ArrowUpRight className="w-4 h-4 text-gray-500" /> : <ArrowDownLeft className="w-4 h-4 text-red-500" />}
                <span>{block.title}</span>
                <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {formatCurrency(total)}
                </span>
              </h4>
              {block.items.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">No {block.type} recorded in this period.</div>
              ) : (
                <div className="space-y-3.5">
                  {block.items.map((cat, i) => {
                    const pct = total > 0 ? ((cat.value / total) * 100).toFixed(1) : '0';
                    return (
                      <div key={i} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-700 truncate max-w-[160px]">{cat.category}</span>
                          <span className="font-bold text-slate-900">
                            {formatCurrency(cat.value)} <span className="font-normal text-[10px] text-slate-400">({pct}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`${block.accent === 'emerald' ? 'bg-black' : 'bg-red-500'} h-full rounded-full transition-all duration-500`}
                            style={{ width: `${(cat.value / maxVal) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Transaction Ledger */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <Banknote className="w-4 h-4 text-slate-400" />
              <span>All Transactions</span>
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {cashFlowLedger.length} record(s) • Manual entries can be edited or deleted; POS rows are auto-generated.
            </p>
          </div>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg shrink-0">
            Net: {formatCurrency(cashFlowLedger.reduce((s, r) => s + (r.type === 'income' ? r.amount : -r.amount), 0))}
          </span>
        </div>

        {cashFlowLedger.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <Wallet className="w-8 h-8 text-slate-300" />
            <span>No cash flow records match the current filters.</span>
            <button
              onClick={openNewCashFlowModal}
              className="mt-2 text-gray-900 font-bold hover:underline flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>Record your first income or expense</span>
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="grid grid-cols-1 gap-3 sm:hidden p-4">
              {cashFlowLedger.map((row) => {
                const manualEntry = row.source === 'manual' ? cashFlowEntries.find(e => e.id === row.key) : null;
                return (
                  <div key={row.key} className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2.5">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-950 text-xs truncate">{row.title}</h4>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">{new Date(row.created_at).toLocaleString()}</p>
                      </div>
                      <span className={`font-mono font-bold text-xs shrink-0 ${row.type === 'income' ? 'text-gray-900' : 'text-red-600'}`}>
                        {row.type === 'income' ? '+' : '−'}{formatCurrency(row.amount)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${
                        row.type === 'income' ? 'bg-gray-100 text-gray-900' : 'bg-red-100 text-red-800'
                      }`}>
                        {row.type}
                      </span>
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[8px] font-bold">{row.category}</span>
                      {row.source === 'sale' && (
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-50 text-gray-900 text-[8px] font-bold">POS Auto</span>
                      )}
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[8px] font-bold uppercase">{row.payment_method}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">By: <strong className="text-slate-700">{row.performed_by}</strong></span>
                      <span className="text-slate-400 italic truncate max-w-[150px]">{row.notes}</span>
                    </div>
                    {manualEntry && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEditCashFlow(manualEntry)}
                          className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-900 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => triggerDeleteCashFlow(manualEntry)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[820px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider text-[10px]">
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Title</th>
                    <th className="p-3.5 text-right">Amount</th>
                    <th className="p-3.5">Payment</th>
                    <th className="p-3.5">Branch</th>
                    <th className="p-3.5">Recorded By</th>
                    <th className="p-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {cashFlowLedger.map((row) => {
                    const manualEntry = row.source === 'manual' ? cashFlowEntries.find(e => e.id === row.key) : null;
                    return (
                      <tr key={row.key} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3.5 text-slate-400 whitespace-nowrap font-mono text-[10px]">
                          {new Date(row.created_at).toLocaleString()}
                        </td>
                        <td className="p-3.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            row.type === 'income' ? 'bg-gray-100 text-gray-900' : 'bg-red-100 text-red-800'
                          }`}>
                            {row.type}
                          </span>
                          {row.source === 'sale' && (
                            <span className="ml-1.5 inline-flex px-2 py-0.5 rounded-full bg-gray-50 text-gray-900 text-[9px] font-bold">POS Auto</span>
                          )}
                        </td>
                        <td className="p-3.5 font-semibold text-slate-700">{row.category}</td>
                        <td className="p-3.5 font-bold text-slate-900">
                          <span className="block max-w-[200px] truncate" title={row.title}>{row.title}</span>
                          {row.notes && <span className="text-[10px] text-slate-400 font-normal italic block max-w-[200px] truncate">{row.notes}</span>}
                        </td>
                        <td className={`p-3.5 text-right font-mono font-bold whitespace-nowrap ${row.type === 'income' ? 'text-gray-900' : 'text-red-600'}`}>
                          {row.type === 'income' ? '+' : '−'}{formatCurrency(row.amount)}
                        </td>
                        <td className="p-3.5">
                          <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-bold uppercase">{row.payment_method}</span>
                        </td>
                        <td className="p-3.5 text-slate-500 font-medium">{row.branch_name || 'All'}</td>
                        <td className="p-3.5 text-slate-600 font-medium">{row.performed_by}</td>
                        <td className="p-3.5">
                          <div className="flex items-center justify-center gap-1">
                            {manualEntry ? (
                              <>
                                <button
                                  onClick={() => startEditCashFlow(manualEntry)}
                                  className="p-1.5 hover:bg-gray-50 text-gray-900 hover:text-gray-900 rounded transition-colors cursor-pointer"
                                  title="Edit entry"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => triggerDeleteCashFlow(manualEntry)}
                                  className="p-1.5 hover:bg-red-50 text-red-600 hover:text-red-800 rounded transition-colors cursor-pointer"
                                  title="Delete entry"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <span className="text-[9px] text-slate-300 font-bold">auto</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
