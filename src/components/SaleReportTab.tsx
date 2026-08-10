import React, { useState, useMemo } from 'react';
import { SaleWithItems, Branch, UserProfile } from '../types';
import { formatCurrency } from '../utils/format';
import { Calendar, Filter, ChevronDown, ChevronUp, Search, Receipt } from 'lucide-react';

interface SaleReportTabProps {
  sales: SaleWithItems[];
  branches: Branch[];
  cashiers: UserProfile[];
  currency: string;
}

export default function SaleReportTab({ sales, branches, cashiers, currency }: SaleReportTabProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'this-month' | 'last-month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [cashierFilter, setCashierFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSales = useMemo(() => {
    let result = sales;

    // Date Filter
    if (dateFilter !== 'all') {
      const now = new Date();
      if (dateFilter === 'this-month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        result = result.filter(s => new Date(s.created_at).getTime() >= start);
      } else if (dateFilter === 'last-month') {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).getTime();
        result = result.filter(s => {
          const t = new Date(s.created_at).getTime();
          return t >= start && t <= end;
        });
      } else if (dateFilter === 'custom') {
        const start = startDate ? new Date(startDate).getTime() : 0;
        const end = endDate ? new Date(endDate).getTime() + 86399999 : Infinity;
        result = result.filter(s => {
          const t = new Date(s.created_at).getTime();
          return t >= start && t <= end;
        });
      }
    }

    // Branch Filter
    if (branchFilter !== 'all') {
      result = result.filter(s => s.branch_id === branchFilter);
    }

    // Cashier Filter
    if (cashierFilter !== 'all') {
      result = result.filter(s => s.cashier_id === cashierFilter);
    }

    // Search Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.id.toLowerCase().includes(q) || 
        (s.customer_name || '').toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [sales, dateFilter, startDate, endDate, branchFilter, cashierFilter, searchQuery]);

  const totalAmount = filteredSales.reduce((sum, s) => sum + s.total_amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-black" />
            Sale Report
          </h2>
          <p className="text-sm text-slate-500 mt-1">Detailed view of all sales transactions</p>
        </div>
        
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-sm font-medium transition-colors"
        >
          <Filter className="w-4 h-4" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
          {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {showFilters && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDateFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateFilter === 'all' ? 'bg-black text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              All Time
            </button>
            <button
              onClick={() => setDateFilter('this-month')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateFilter === 'this-month' ? 'bg-black text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              This Month
            </button>
            <button
              onClick={() => setDateFilter('last-month')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateFilter === 'last-month' ? 'bg-black text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Last Month
            </button>
            <button
              onClick={() => setDateFilter('custom')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateFilter === 'custom' ? 'bg-black text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Custom
            </button>
          </div>

          {dateFilter === 'custom' && (
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">From:</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">To:</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Branch</label>
              <select 
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="all">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Cashier</label>
              <select 
                value={cashierFilter}
                onChange={(e) => setCashierFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="all">All Cashiers</option>
                {cashiers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Search</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Search by ID or Customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-700">{filteredSales.length} Transactions</span>
          <span className="text-sm font-bold text-gray-900">Total: {formatCurrency(totalAmount)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-white border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
                <th className="p-4 font-semibold">Date & ID</th>
                <th className="p-4 font-semibold">Cashier</th>
                <th className="p-4 font-semibold">Branch</th>
                <th className="p-4 font-semibold">Customer</th>
                <th className="p-4 font-semibold">Method</th>
                <th className="p-4 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredSales.map(sale => (
                <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-gray-900">
                      {new Date(sale.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      #{sale.id.slice(0, 8)}
                    </div>
                  </td>
                  <td className="p-4 text-slate-700">{sale.cashier_name}</td>
                  <td className="p-4 text-slate-700">{sale.branch_name || '-'}</td>
                  <td className="p-4 text-slate-700">{sale.customer_name || '-'}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold ${
                      sale.payment_method === 'cash' ? 'bg-slate-100 text-slate-700' :
                      sale.payment_method === 'card' ? 'bg-black text-white' :
                      'bg-slate-200 text-slate-800'
                    }`}>
                      {sale.payment_method.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 text-right font-bold text-gray-900">
                    {formatCurrency(sale.total_amount)}
                  </td>
                </tr>
              ))}
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No sales found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
