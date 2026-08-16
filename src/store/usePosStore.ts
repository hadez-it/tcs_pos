import { create } from 'zustand';
import { dbService } from '../lib/supabase';
import { Product, SaleWithItems, UserProfile, InventoryTransaction, Branch, BusinessProfile, CashFlowEntry, SaleDeleteRequest } from '../types';

interface PosStore {
  products: Product[];
  sales: SaleWithItems[];
  cashiers: UserProfile[];
  transactions: InventoryTransaction[];
  branches: Branch[];
  deleteRequests: SaleDeleteRequest[];
  businessProfile: BusinessProfile | null;
  cashFlowEntries: CashFlowEntry[];
  isLoading: boolean;
  
  setProducts: (products: Product[]) => void;
  setSales: (sales: SaleWithItems[]) => void;
  setCashiers: (cashiers: UserProfile[]) => void;
  setTransactions: (transactions: InventoryTransaction[]) => void;
  setBranches: (branches: Branch[]) => void;
  setDeleteRequests: (requests: SaleDeleteRequest[]) => void;
  setBusinessProfile: (profile: BusinessProfile) => void;
  setCashFlowEntries: (entries: CashFlowEntry[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  
  loadData: (silent?: boolean) => Promise<void>;
}

let activeFetchPromise: Promise<void> | null = null;

export const usePosStore = create<PosStore>((set) => ({
  products: [],
  sales: [],
  cashiers: [],
  transactions: [],
  branches: [],
  deleteRequests: [],
  businessProfile: null,
  cashFlowEntries: [],
  isLoading: true,
  
  setProducts: (products) => set({ products }),
  setSales: (sales) => set({ sales }),
  setCashiers: (cashiers) => set({ cashiers }),
  setTransactions: (transactions) => set({ transactions }),
  setBranches: (branches) => set({ branches }),
  setDeleteRequests: (deleteRequests) => set({ deleteRequests }),
  setBusinessProfile: (businessProfile) => set({ businessProfile }),
  setCashFlowEntries: (cashFlowEntries) => set({ cashFlowEntries }),
  setIsLoading: (isLoading) => set({ isLoading }),
  
  loadData: async (silent = false) => {
    if (activeFetchPromise) {
      return activeFetchPromise;
    }

    if (!silent) {
      set({ isLoading: true });
    }

    activeFetchPromise = (async () => {
      try {
        const [products, sales, cashiers, transactions, branches, businessProfile, cashFlowEntries, deleteRequests] = await Promise.all([
          dbService.products.getAll(),
          dbService.sales.getAllWithItems(),
          dbService.auth.getCashiers(),
          dbService.transactions.getAll(),
          dbService.branches.getAll(),
          dbService.business.get(),
          dbService.cashFlow.getAll(),
          dbService.saleDeleteRequests.getAll()
        ]);
        set({
          products,
          sales,
          cashiers,
          transactions,
          branches,
          businessProfile: businessProfile || null,
          cashFlowEntries,
          deleteRequests
        });
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        if (!silent) {
          set({ isLoading: false });
        }
        activeFetchPromise = null;
      }
    })();

    return activeFetchPromise;
  }
}));
