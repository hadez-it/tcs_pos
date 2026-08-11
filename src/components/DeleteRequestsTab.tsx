import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../lib/supabase';
import { SaleDeleteRequest, Branch, UserProfile, SaleWithItems } from '../types';
import { formatCurrency } from '../utils/format';
import { useToast } from '../utils/toast';
import { Search, Filter, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, FileText, Check, X } from 'lucide-react';

interface DeleteRequestsTabProps {
  user: UserProfile;
  branches: Branch[];
  selectedBranchId: string;
  onDataChanged?: () => void;
}

export default function DeleteRequestsTab({ user, branches, selectedBranchId, onDataChanged }: DeleteRequestsTabProps) {
  const { toast } = useToast();
  const [requests, setRequests] = useState<SaleDeleteRequest[]>([]);
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

  const [confirmApproveModal, setConfirmApproveModal] = useState<SaleDeleteRequest | null>(null);
  const [confirmRejectModal, setConfirmRejectModal] = useState<SaleDeleteRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const loadRequestsData = async () => {
    setIsLoading(true);
    try {
      const [allReqs, allSales] = await Promise.all([
        dbService.saleDeleteRequests.getAll(),
        dbService.sales.getAllWithItems()
      ]);
      setRequests(allReqs);
      setSales(allSales);
    } catch (err) {
      console.error('Failed to load delete requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequestsData();
  }, []);

  const handleApprove = async () => {
    if (!confirmApproveModal || isProcessing) return;
    setIsProcessing(true);
    try {
      await dbService.saleDeleteRequests.approve(confirmApproveModal.id, user.name);
      toast(`Delete request for Sale #${confirmApproveModal.sale_id.slice(0, 8)} approved and items restored to inventory!`, 'success');
      setConfirmApproveModal(null);
      await loadRequestsData();
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      toast(err.message || 'Failed to approve request.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!confirmRejectModal || isProcessing) return;
    setIsProcessing(true);
    try {
      await dbService.saleDeleteRequests.reject(confirmRejectModal.id, user.name, rejectionReason);
      toast(`Delete request rejected.`, 'info');
      setConfirmRejectModal(null);
      setRejectionReason('');
      await loadRequestsData();
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      toast(err.message || 'Failed to reject request.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const matchesBranch = selectedBranchId === 'all' || req.branch_id === selectedBranchId;
      const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        req.cashier_name.toLowerCase().includes(q) ||
        req.sale_id.toLowerCase().includes(q) ||
        (req.reason && req.reason.toLowerCase().includes(q))
      );
      return matchesBranch && matchesStatus && matchesSearch;
    });
  }, [requests, selectedBranchId, statusFilter, searchQuery]);

  const counts = useMemo(() => {
    const branchReqs = selectedBranchId === 'all' ? requests : requests.filter(r => r.branch_id === selectedBranchId);
    return {
      total: branchReqs.length,
      pending: branchReqs.filter(r => r.status === 'pending').length,
      approved: branchReqs.filter(r => r.status === 'approved').length,
      rejected: branchReqs.filter(r => r.status === 'rejected').length,
    };
  }, [requests, selectedBranchId]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-premium flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-bold block">Total Requests</span>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">{counts.total}</h3>
          </div>
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-premium flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-bold block">Pending Approval</span>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">{counts.pending}</h3>
          </div>
          <div className="p-3 bg-slate-100 text-slate-900 rounded-xl relative">
            <Clock className="w-5 h-5" />
            {counts.pending > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-black rounded-full animate-ping" />
            )}
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-premium flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-bold block">Approved & Restored</span>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">{counts.approved}</h3>
          </div>
          <div className="p-3 bg-slate-100 text-slate-800 rounded-xl">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-premium flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-bold block">Rejected</span>
            <h3 className="text-lg sm:text-xl font-extrabold text-red-600 mt-1">{counts.rejected}</h3>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-premium space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute inset-y-0 left-0 pl-3.5 w-4 h-4 my-auto text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search cashier, sale ID, reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-gray-900"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
              {(['all', 'pending', 'approved', 'rejected'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize transition-all cursor-pointer ${
                    statusFilter === st ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {st} {st === 'pending' && counts.pending > 0 && `(${counts.pending})`}
                </button>
              ))}
            </div>

            <button
              onClick={loadRequestsData}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer"
              title="Refresh requests"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-8 h-8 border-[3px] border-gray-900/20 border-t-gray-900 rounded-full animate-spin" />
            <span className="text-slate-400 text-xs mt-3">Loading sale delete requests...</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText className="w-12 h-12 text-slate-200 mb-3" />
            <p className="text-sm font-semibold">No delete requests found</p>
            <p className="text-xs text-slate-400 mt-1">Cashier deletion requests will appear here for your approval.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((req) => {
              const matchedSale = sales.find(s => s.id === req.sale_id);
              const isExpanded = expandedRequestId === req.id;

              return (
                <div key={req.id} className="android-card p-4 border border-slate-200/90 rounded-2xl bg-white space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                        req.status === 'pending' ? 'bg-slate-100 text-slate-800' :
                        req.status === 'approved' ? 'bg-slate-900 text-white' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {req.status === 'pending' ? <Clock className="w-5 h-5" /> :
                         req.status === 'approved' ? <Check className="w-5 h-5" /> :
                         <X className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 text-xs">Sale #{req.sale_id.slice(0, 8)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            req.status === 'pending' ? 'bg-slate-100 text-slate-800 border border-slate-200' :
                            req.status === 'approved' ? 'bg-slate-900 text-white' :
                            'bg-red-100 text-red-600 border border-red-200'
                          }`}>
                            {req.status === 'pending' ? 'Pending Approval' :
                             req.status === 'approved' ? 'Approved & Stock Restored' :
                             'Rejected'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Requested by <strong className="text-slate-800">{req.cashier_name}</strong> {req.branch_name ? `(${req.branch_name})` : ''} • {new Date(req.requested_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <span className="font-mono text-base font-extrabold text-slate-900">{formatCurrency(req.total_amount)}</span>
                      {req.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setConfirmRejectModal(req)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl transition-all cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => setConfirmApproveModal(req)}
                            className="px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                          >
                            Approve & Restore Stock
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {req.reason && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                      <span className="font-bold text-slate-700 block mb-0.5">Reason given:</span>
                      <span className="text-slate-600">{req.reason}</span>
                    </div>
                  )}

                  {req.status !== 'pending' && req.reviewed_by && (
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                      <span>Reviewed by <strong className="text-slate-600">{req.reviewed_by}</strong> on {req.reviewed_at ? new Date(req.reviewed_at).toLocaleString() : ''}</span>
                      {req.rejection_reason && <span className="text-red-500 font-semibold">• Reason: {req.rejection_reason}</span>}
                    </div>
                  )}

                  {matchedSale && matchedSale.items && matchedSale.items.length > 0 && (
                    <div>
                      <button
                        onClick={() => setExpandedRequestId(isExpanded ? null : req.id)}
                        className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer pt-1"
                      >
                        <span>{isExpanded ? 'Hide' : 'View'} Sale Items ({matchedSale.items.length})</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
                          {matchedSale.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-slate-700 font-medium">
                              <span>{item.product_name} <strong className="font-mono text-slate-900">x{item.quantity}</strong></span>
                              <span className="font-mono">{formatCurrency(item.total)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Approve Confirmation Modal */}
      {confirmApproveModal && (
        <div className="bottom-sheet-overlay" onClick={() => setConfirmApproveModal(null)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="pt-3 pb-2">
              <div className="pull-indicator" />
            </div>
            <div className="px-4 pb-3 flex items-center justify-between border-b border-slate-100">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-slate-900" />
                Confirm Approve Sale Deletion
              </h4>
              <button onClick={() => setConfirmApproveModal(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <p className="font-bold text-slate-900">Sale #{confirmApproveModal.sale_id.slice(0, 8)} — {formatCurrency(confirmApproveModal.total_amount)}</p>
                <p className="text-slate-500">Requested by {confirmApproveModal.cashier_name}</p>
                {confirmApproveModal.reason && <p className="text-slate-600 italic">"{confirmApproveModal.reason}"</p>}
              </div>

              <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-800 space-y-1">
                <p className="font-bold">Items will be returned to stock:</p>
                <p className="text-slate-600">Approving this request will void the sale and restore the item quantities back into product inventory.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setConfirmApproveModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? 'Restoring Stock...' : 'Confirm & Restore Stock'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {confirmRejectModal && (
        <div className="bottom-sheet-overlay" onClick={() => setConfirmRejectModal(null)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="pt-3 pb-2">
              <div className="pull-indicator" />
            </div>
            <div className="px-4 pb-3 flex items-center justify-between border-b border-slate-100">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                Reject Sale Delete Request
              </h4>
              <button onClick={() => setConfirmRejectModal(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <p className="font-bold text-slate-900">Sale #{confirmRejectModal.sale_id.slice(0, 8)} — {formatCurrency(confirmRejectModal.total_amount)}</p>
                <p className="text-slate-500">Requested by {confirmRejectModal.cashier_name}</p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Rejection Reason (Optional)</label>
                <input
                  type="text"
                  placeholder="Reason for rejecting request..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="android-input w-full p-2.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setConfirmRejectModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? 'Rejecting...' : 'Reject Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
