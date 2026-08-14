import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { usePosStore } from '../../store/usePosStore';
import { UserProfile } from '../../types';

interface TransactionsTabProps {
  user: UserProfile;
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
}

export default function TransactionsTab({
  user,
  selectedBranchId,
  setSelectedBranchId
}: TransactionsTabProps) {
  const { branches, transactions } = usePosStore();
  const [txSearch, setTxSearch] = useState('');

  const displayTxs = useMemo(() => {
    return selectedBranchId === 'all'
      ? transactions
      : transactions.filter(t => t.branch_id === selectedBranchId);
  }, [transactions, selectedBranchId]);

  const filteredTxs = useMemo(() => {
    return displayTxs.filter(tx => {
      return tx.product_name.toLowerCase().includes(txSearch.toLowerCase()) ||
             tx.performed_by.toLowerCase().includes(txSearch.toLowerCase()) ||
             tx.notes.toLowerCase().includes(txSearch.toLowerCase()) ||
             tx.type.toLowerCase().includes(txSearch.toLowerCase());
    });
  }, [displayTxs, txSearch]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-200 flex justify-end gap-3">
        {user.role !== 'manager' && branches.length > 0 && (
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-gray-900 shadow-sm cursor-pointer"
          >
            <option value="all">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        <div className="relative max-w-xs w-full">
          <Search className="absolute inset-y-0 left-0 pl-3 w-4 h-4 my-auto text-slate-400" />
          <input
            type="text"
            placeholder="Filter by product, action, or staff..."
            value={txSearch}
            onChange={(e) => setTxSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-gray-900 focus:bg-white"
          />
        </div>
      </div>

      {/* Audit Logs Mobile Cards & Desktop Table */}
      <div className="p-4 sm:p-0">
        {filteredTxs.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs">No audit logs recorded matching search queries.</div>
        ) : (
          <>
            {/* Mobile Card List */}
            <div className="grid grid-cols-1 gap-3 sm:hidden pb-4">
              {filteredTxs.map((tx) => {
                const isAdd = tx.type === 'stock-in';
                const isSub = tx.type === 'stock-out' || tx.type === 'sale';

                return (
                  <div key={tx.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(tx.created_at).toLocaleString()}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                        tx.type === 'stock-in'
                          ? 'bg-gray-100 text-gray-900'
                          : tx.type === 'sale'
                            ? 'bg-gray-100 text-gray-900'
                            : 'bg-gray-100 text-gray-900'
                      }`}>
                        {tx.type}
                      </span>
                    </div>

                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-slate-900 text-xs">{tx.product_name}</h4>
                      <span className={`font-mono font-bold text-xs shrink-0 ${
                        isAdd ? 'text-gray-900' : isSub ? 'text-gray-900' : 'text-slate-600'
                      }`}>
                        {isAdd ? '+' : '-'}{tx.quantity} units
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[10px]">
                      <span className="text-slate-500">By: <strong className="text-slate-700">{tx.performed_by}</strong></span>
                      <span className="text-slate-500 italic truncate max-w-[180px]">{tx.notes}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider">
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Product Name</th>
                    <th className="p-4">Action</th>
                    <th className="p-4 text-center">Qty Shift</th>
                    <th className="p-4">Performed By</th>
                    <th className="p-4">Audit Description Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredTxs.map((tx) => {
                    const isAdd = tx.type === 'stock-in';
                    const isSub = tx.type === 'stock-out' || tx.type === 'sale';

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 text-slate-400 whitespace-nowrap font-mono text-[10px]">
                          {new Date(tx.created_at).toLocaleString()}
                        </td>
                        <td className="p-4 font-bold text-slate-900">{tx.product_name}</td>
                        <td className="p-4">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            tx.type === 'stock-in'
                              ? 'bg-gray-100 text-gray-900'
                              : tx.type === 'sale'
                                ? 'bg-gray-100 text-gray-900'
                                : 'bg-gray-100 text-gray-900'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`font-mono font-bold ${
                            isAdd ? 'text-gray-900' : isSub ? 'text-gray-900' : 'text-slate-600'
                          }`}>
                            {isAdd ? '+' : '-'}{tx.quantity} units
                          </span>
                        </td>
                        <td className="p-4 font-bold text-slate-700">{tx.performed_by}</td>
                        <td className="p-4 text-slate-500 italic max-w-xs truncate">{tx.notes}</td>
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
