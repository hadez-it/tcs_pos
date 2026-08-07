import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Users, Package, AlertTriangle, LogOut, Plus, Search, 
  Edit2, Trash2, Calendar, Clipboard, ShoppingCart, UserPlus, DollarSign,
  Briefcase, CheckCircle, RefreshCw, Layers, Shield, FileText, Building2, Store, MapPin,
  Database, Copy, Download, Printer, Tag, FileSpreadsheet, Upload, Award, Eye, Receipt, CreditCard,
  Menu, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Image, Sparkles, Globe, Phone, Mail, Check, Settings,
  ArrowUpRight, ArrowDownLeft, Wallet, Banknote, TrendingDown, PackagePlus
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { dbService, isSupabaseConfigured, DEFAULT_BUSINESS_PROFILE, formatEmailWithDefaultDomain } from '../lib/supabase';
import { Product, SaleWithItems, UserProfile, InventoryTransaction, SalesAnalytics, Branch, BusinessProfile, CashFlowEntry, CashFlowType, PaymentMethod } from '../types';
import { formatCurrency } from '../utils/format';
import { useToast } from '../utils/toast';
import { useBackDismiss, useBackTabHistory } from '../lib/backNavigation';
import { SUPABASE_SCHEMA_SQL } from '../data/schemaSql';
import BarcodePrintModal from './BarcodePrintModal';
import CsvImportModal from './CsvImportModal';
import SearchableCategorySelect from './SearchableCategorySelect';
import QuickRestockModal from './QuickRestockModal';

interface OwnerDashboardProps {
  user: UserProfile;
  onLogout: () => void;
}

export default function OwnerDashboard({ user, onLogout }: OwnerDashboardProps) {
  const { toast } = useToast();
  // State for raw data
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [cashiers, setCashiers] = useState<UserProfile[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'cashiers' | 'staff-performance' | 'transactions' | 'branches' | 'settings' | 'cash-flow'>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTabChanging, setIsTabChanging] = useState(false);

  // Business Profile & Branding State
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(DEFAULT_BUSINESS_PROFILE);
  const [businessForm, setBusinessForm] = useState<BusinessProfile>(DEFAULT_BUSINESS_PROFILE);
  const [businessSaving, setBusinessSaving] = useState(false);
  const [businessSuccessMsg, setBusinessSuccessMsg] = useState<string | null>(null);
  const [businessErrorMsg, setBusinessErrorMsg] = useState<string | null>(null);

  // Cash Flow State
  const [cashFlowEntries, setCashFlowEntries] = useState<CashFlowEntry[]>([]);
  const [cfRange, setCfRange] = useState<'today' | '7d' | '30d' | 'month' | 'all'>('7d');
  const [cfTypeFilter, setCfTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [cfSearch, setCfSearch] = useState('');
  const [cfCategoryFilter, setCfCategoryFilter] = useState('All');

  const [showCashFlowModal, setShowCashFlowModal] = useState(false);
  const [showCfFilters, setShowCfFilters] = useState(false);
  const [editingCashFlow, setEditingCashFlow] = useState<CashFlowEntry | null>(null);
  const [cfForm, setCfForm] = useState({
    type: 'expense' as CashFlowType,
    title: '',
    amount: '',
    category: '',
    payment_method: 'cash' as PaymentMethod,
    date: '',
    branch_id: '',
    notes: ''
  });
  const [cfFormError, setCfFormError] = useState<string | null>(null);
  const [cfFormSuccess, setCfFormSuccess] = useState<string | null>(null);
  const [isCfSubmitting, setIsCfSubmitting] = useState(false);
  const [isCfExporting, setIsCfExporting] = useState(false);

  const INCOME_CATEGORIES = ['POS Sales', 'Investment', 'Loan Received', 'Other Income'];
  const EXPENSE_CATEGORIES = ['Inventory / Stock', 'Rent', 'Salaries', 'Utilities', 'Transport', 'Supplies', 'Marketing', 'Repairs', 'Other Expense'];

  const handleTabSwitch = (tab: 'overview' | 'products' | 'cashiers' | 'staff-performance' | 'transactions' | 'branches' | 'settings' | 'cash-flow') => {
    // 1. Immediately close sidebar drawer for zero-lag menu response
    setIsSidebarOpen(false);

    if (tab === activeTab) return;

    // 2. Show page skeleton immediately and defer heavy DOM rendering to next frame
    setIsTabChanging(true);
    setTimeout(() => {
      React.startTransition(() => {
        setActiveTab(tab);
        setTimeout(() => {
          setIsTabChanging(false);
        }, 60);
      });
    }, 80);
  };

  // Interactive Modals / Forms States
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    description: '',
    category: '',
    image: '',
    use_stock: true,
    price: '',
    cost: '',
    unit_amount: '1',
    unit_name: 'pcs',
    stock: '',
    min_stock_level: '5',
    price_variant: 'Standard',
    expiry_date: '',
    branch_id: ''
  });

  const [showCashierModal, setShowCashierModal] = useState(false);
  const [editingCashier, setEditingCashier] = useState<UserProfile | null>(null);
  const [cashierForm, setCashierForm] = useState({
    name: '',
    email: '',
    password: '',
    branch_id: ''
  });
  const [cashierSearch, setCashierSearch] = useState('');

  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchForm, setBranchForm] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    manager_name: ''
  });

  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState('All'); // 'All' | 'Low Stock' | 'Out of Stock'
  const [productPage, setProductPage] = useState(1);
  const PRODUCTS_PER_PAGE = 20;

  // Auto-reset pagination to page 1 whenever filters or search query change
  useEffect(() => {
    setProductPage(1);
  }, [productSearch, categoryFilter, stockFilter, selectedBranchId]);

  const [txSearch, setTxSearch] = useState('');
  
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  // Guards modal form submits (product/cashier/branch) against double-clicks
  const [isSubmitting, setIsSubmitting] = useState(false);
  // True while auto-generating a SKU / barcode for the new-product form
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);

  // Delete Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    type: 'branch' | 'cashier' | 'product' | 'cash-flow';
    title: string;
    description: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // SQL Schema Modal State
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Barcode Printing Modal State
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeProductId, setBarcodeProductId] = useState<string | null>(null);

  // CSV Import Modal State
  const [showCsvModal, setShowCsvModal] = useState(false);

  // Quick Restock Modal State
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [isRestocking, setIsRestocking] = useState(false);

  // Cashier Sales History Modal State
  const [selectedCashierForHistory, setSelectedCashierForHistory] = useState<{ cashier: UserProfile; sales: SaleWithItems[] } | null>(null);

  const openBarcodePrintModal = (productId?: string) => {
    setBarcodeProductId(productId || null);
    setShowBarcodeModal(true);
  };

  // Mints a unique SKU + next sequential barcode and drops them into the form.
  const fillGeneratedCodes = async () => {
    setIsGeneratingCodes(true);
    try {
      const { sku, barcode } = await dbService.products.generateCodes();
      setProductForm(prev => ({ ...prev, sku, barcode }));
    } catch (err: any) {
      setFormError(err.message || 'Could not generate SKU / barcode. Please enter them manually.');
      toast(err.message || 'Could not generate SKU / barcode.', 'error');
    } finally {
      setIsGeneratingCodes(false);
    }
  };

  const openNewProductModal = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      sku: '',
      barcode: '',
      description: '',
      category: '',
      image: '',
      use_stock: true,
      price: '',
      cost: '',
      unit_amount: '1',
      unit_name: 'pcs',
      stock: '',
      min_stock_level: '5',
      price_variant: 'Standard',
      expiry_date: '',
      branch_id: ''
    });
    setFormError(null);
    setFormSuccess(null);
    setShowProductModal(true);
    // Prefill codes in the background so the modal opens instantly.
    void fillGeneratedCodes();
  };

  const openNewCashierModal = () => {
    setEditingCashier(null);
    setCashierForm({ name: '', email: '', password: '', branch_id: '' });
    setFormError(null);
    setFormSuccess(null);
    setShowCashierModal(true);
  };

  const startEditCashier = (cashier: UserProfile) => {
    setEditingCashier(cashier);
    setCashierForm({
      name: cashier.name || '',
      email: cashier.email || '',
      password: '',
      branch_id: cashier.branch_id || ''
    });
    setFormError(null);
    setFormSuccess(null);
    setShowCashierModal(true);
  };

  const openNewBranchModal = () => {
    setEditingBranch(null);
    setBranchForm({ name: '', code: '', address: '', phone: '', manager_name: '' });
    setFormError(null);
    setFormSuccess(null);
    setShowBranchModal(true);
  };

  const handleExportCsv = () => {
    const headers = [
      'ID', 'Name', 'Image', 'Description', 'Category', 'Use Stock',
      'Purchased Price', 'Unit Amount', 'Unit Price', 'Unit Name',
      'Stock', 'Price Variant', 'Expiry Date', 'Updated Date', 'Barcode'
    ];

    const rows = products.map(p => [
      `"${p.id || p.sku || ''}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${p.image || 'null'}"`,
      `"${(p.description || '').replace(/"/g, '""')}"`,
      `"${p.category || ''}"`,
      `"${p.use_stock !== false ? 'true' : 'false'}"`,
      p.cost || 0,
      p.unit_amount || 1,
      p.price || 0,
      `"${p.unit_name || 'ခု'}"`,
      p.stock || 0,
      `"${p.price_variant || ''}"`,
      `"${p.expiry_date || ''}"`,
      `"${p.updated_at || new Date().toLocaleString()}"`,
      `"${p.barcode || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `inventory_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCsvSuccess = async (importedItems: Partial<Product>[], branchId: string, branchName: string) => {
    await dbService.products.bulkImport(importedItems, user.name, branchId, branchName);
    await loadData();
    toast(`Successfully imported ${importedItems.length} products!`, 'success');
  };

  const openQuickRestock = (prod: Product) => {
    setRestockProduct(prod);
  };

  const handleQuickRestock = async (productId: string, quantity: number) => {
    if (isRestocking) return;
    setIsRestocking(true);
    try {
      await dbService.products.restock(productId, quantity, user.name);
      await loadData();
      setRestockProduct(null);
      setIsRestocking(false);
      toast(`Stock added: +${quantity}.`, 'success');
    } catch (err: any) {
      setIsRestocking(false);
      throw err;
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleDownloadSql = () => {
    const blob = new Blob([SUPABASE_SCHEMA_SQL], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supabase_schema.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Load all dashboard data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allProducts, allSales, allCashiers, allTxs, allBranches, bizInfo, allCashFlow] = await Promise.all([
        dbService.products.getAll(),
        dbService.sales.getAllWithItems(),
        dbService.auth.getCashiers(),
        dbService.transactions.getAll(),
        dbService.branches.getAll(),
        dbService.business.get(),
        dbService.cashFlow.getAll()
      ]);
      setProducts(allProducts);
      setSales(allSales);
      setCashiers(allCashiers);
      setTransactions(allTxs);
      setBranches(allBranches);
      setCashFlowEntries(allCashFlow);
      if (bizInfo) {
        setBusinessProfile(bizInfo);
        setBusinessForm(bizInfo);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setBusinessErrorMsg('Image file is too large (max 3MB). Please choose a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setBusinessForm(prev => ({ ...prev, logo_url: result }));
      setBusinessErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  const handleBusinessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (businessSaving) return;
    if (!businessForm.name.trim()) {
      setBusinessErrorMsg('Business name cannot be empty.');
      return;
    }

    setBusinessSaving(true);
    setBusinessErrorMsg(null);
    setBusinessSuccessMsg(null);

    try {
      const updated = await dbService.business.update(businessForm);
      setBusinessProfile(updated);
      setBusinessSuccessMsg('Business name and logo updated successfully!');
      setTimeout(() => setBusinessSuccessMsg(null), 4000);
    } catch (err: any) {
      setBusinessErrorMsg(err?.message || 'Failed to save business settings.');
    } finally {
      setBusinessSaving(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter sales/products by selectedBranchId
  const displaySales = useMemo(() => {
    return selectedBranchId === 'all' 
      ? sales 
      : sales.filter(s => s.branch_id === selectedBranchId);
  }, [sales, selectedBranchId]);

  const displayProducts = useMemo(() => {
    return selectedBranchId === 'all'
      ? products
      : products.filter(p => !p.branch_id || p.branch_id === selectedBranchId);
  }, [products, selectedBranchId]);

  const displayCashiers = useMemo(() => {
    return selectedBranchId === 'all'
      ? cashiers
      : cashiers.filter(c => c.branch_id === selectedBranchId);
  }, [cashiers, selectedBranchId]);

  const displayTxs = useMemo(() => {
    return selectedBranchId === 'all'
      ? transactions
      : transactions.filter(t => t.branch_id === selectedBranchId);
  }, [transactions, selectedBranchId]);

  // Compute Analytics
  const analytics = useMemo((): SalesAnalytics => {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalSalesCount = displaySales.length;

    // Sum revenue and cost from actual sales items
    displaySales.forEach(sale => {
      totalRevenue += sale.total_amount;
      // Calculate total cost for the items in this sale
      sale.items.forEach(item => {
        totalCost += (item.unit_cost * item.quantity);
      });
    });

    const totalProfit = totalRevenue - totalCost;
    const lowStockCount = displayProducts.filter(p => p.stock <= p.min_stock_level).length;

    // Category Sales Distribution
    const categoryMap: { [key: string]: number } = {};
    displaySales.forEach(sale => {
      sale.items.forEach(item => {
        const prod = products.find(p => p.id === item.product_id);
        const cat = prod?.category || 'Uncategorized';
        categoryMap[cat] = (categoryMap[cat] || 0) + item.total;
      });
    });

    const categorySales = Object.entries(categoryMap).map(([category, value]) => ({
      category,
      value: Number(value.toFixed(2))
    })).sort((a, b) => b.value - a.value);

    // Sales over the last 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const salesMapOverTime: { [key: string]: { revenue: number; profit: number; count: number } } = {};
    last7Days.forEach(date => {
      salesMapOverTime[date] = { revenue: 0, profit: 0, count: 0 };
    });

    displaySales.forEach(sale => {
      const dateStr = sale.created_at.split('T')[0];
      if (salesMapOverTime[dateStr]) {
        salesMapOverTime[dateStr].revenue += sale.total_amount;
        salesMapOverTime[dateStr].count += 1;
        // Cost estimation for profit in daily sales
        let saleCost = 0;
        sale.items.forEach(item => {
          saleCost += (item.unit_cost * item.quantity);
        });
        salesMapOverTime[dateStr].profit += (sale.total_amount - saleCost);
      }
    });

    const salesOverTime = Object.entries(salesMapOverTime).map(([date, data]) => {
      const formattedDate = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return {
        date: formattedDate,
        revenue: Number(data.revenue.toFixed(2)),
        profit: Number(data.profit.toFixed(2)),
        count: data.count
      };
    });

    // Top Selling Products
    const productSalesMap: { [key: string]: { quantity: number; revenue: number } } = {};
    displaySales.forEach(sale => {
      sale.items.forEach(item => {
        if (!productSalesMap[item.product_name]) {
          productSalesMap[item.product_name] = { quantity: 0, revenue: 0 };
        }
        productSalesMap[item.product_name].quantity += item.quantity;
        productSalesMap[item.product_name].revenue += item.total;
      });
    });

    const topProducts = Object.entries(productSalesMap).map(([name, data]) => ({
      name,
      quantity: data.quantity,
      revenue: Number(data.revenue.toFixed(2))
    })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    return {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      totalProfit: Number(totalProfit.toFixed(2)),
      totalSalesCount,
      lowStockCount,
      salesOverTime,
      categorySales,
      topProducts
    };
  }, [displaySales, displayProducts, products]);

  // ==========================================
  // CASH FLOW ANALYTICS & LEDGER
  // ==========================================
  const isWithinCfRange = (dateStr: string): boolean => {
    const d = new Date(dateStr);
    const now = new Date();
    switch (cfRange) {
      case 'today': {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        return d.getTime() >= start;
      }
      case '7d':
        return d.getTime() >= now.getTime() - 6 * 24 * 60 * 60 * 1000;
      case '30d':
        return d.getTime() >= now.getTime() - 29 * 24 * 60 * 60 * 1000;
      case 'month':
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      case 'all':
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
    const salesOut = inRangeSales.reduce((s, sale) => s + sale.items.reduce((c, it) => c + (it.unit_cost * it.quantity), 0), 0);

    const today = new Date().toISOString().slice(0, 10);
    const todayManualIn = manual.filter(e => e.type === 'income' && e.created_at.startsWith(today)).reduce((s, e) => s + e.amount, 0);
    const todayManualOut = manual.filter(e => e.type === 'expense' && e.created_at.startsWith(today)).reduce((s, e) => s + e.amount, 0);
    const todaySales = inRangeSales.filter(s => s.created_at.startsWith(today));
    const todaySalesIn = todaySales.reduce((s, sale) => s + sale.total_amount, 0);
    const todaySalesOut = todaySales.reduce((s, sale) => s + sale.items.reduce((c, it) => c + (it.unit_cost * it.quantity), 0), 0);

    const cashIn = manualIn + salesIn;
    const cashOut = manualOut + salesOut;
    const todayIn = todayManualIn + todaySalesIn;
    const todayOut = todayManualOut + todaySalesOut;

    return {
      cashIn: Number(cashIn.toFixed(2)),
      cashOut: Number(cashOut.toFixed(2)),
      net: Number((cashIn - cashOut).toFixed(2)),
      todayNet: Number((todayIn - todayOut).toFixed(2)),
      manualCount: manual.length,
      saleCount: inRangeSales.length
    };
  }, [cashFlowEntries, displaySales, cfRange]);

  const cashFlowDaily = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const now = new Date();
    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let bucketCount: number;
    if (cfRange === 'today') bucketCount = 1;
    else if (cfRange === '7d') bucketCount = 7;
    else if (cfRange === '30d') bucketCount = 30;
    else if (cfRange === 'month') bucketCount = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    else {
      const allDates = [...cashFlowEntries.map(e => e.created_at), ...displaySales.map(s => s.created_at)];
      let earliest = nowStart;
      allDates.forEach(d => {
        const t = new Date(d).getTime();
        if (t < earliest) earliest = t;
      });
      bucketCount = Math.max(7, Math.min(365, Math.floor((nowStart - earliest) / dayMs) + 1));
    }

    const map: { [day: string]: { inflow: number; outflow: number; net: number } } = {};
    for (let i = bucketCount - 1; i >= 0; i--) {
      const day = new Date(nowStart - i * dayMs).toISOString().slice(0, 10);
      map[day] = { inflow: 0, outflow: 0, net: 0 };
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
      sale.items.forEach(it => { map[day].outflow += it.unit_cost * it.quantity; });
    });

    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, v]) => ({
        date: new Date(day + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        inflow: Number(v.inflow.toFixed(2)),
        outflow: Number(v.outflow.toFixed(2)),
        net: Number((v.inflow - v.outflow).toFixed(2))
      }));
  }, [cashFlowEntries, displaySales, cfRange]);

  const cfCategoryBreakdown = useMemo(() => {
    const income: { [cat: string]: number } = {};
    const expense: { [cat: string]: number } = {};

    cashFlowEntries.filter(e => isWithinCfRange(e.created_at)).forEach(e => {
      const target = e.type === 'income' ? income : expense;
      target[e.category] = (target[e.category] || 0) + e.amount;
    });

    displaySales.filter(s => isWithinCfRange(s.created_at)).forEach(sale => {
      income['POS Sales'] = (income['POS Sales'] || 0) + sale.total_amount;
      const cogs = sale.items.reduce((c, it) => c + (it.unit_cost * it.quantity), 0);
      expense['Cost of Goods Sold'] = (expense['Cost of Goods Sold'] || 0) + cogs;
    });

    return {
      income: Object.entries(income).map(([category, value]) => ({ category, value: Number(value.toFixed(2)) })).sort((a, b) => b.value - a.value),
      expense: Object.entries(expense).map(([category, value]) => ({ category, value: Number(value.toFixed(2)) })).sort((a, b) => b.value - a.value)
    };
  }, [cashFlowEntries, displaySales, cfRange]);

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
      const cogs = sale.items.reduce((c, it) => c + (it.unit_cost * it.quantity), 0);
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
      if (matchType('expense') && matchCat('Cost of Goods Sold')) {
        rows.push({
          key: `${sale.id}-cogs`,
          type: 'expense',
          category: 'Cost of Goods Sold',
          title: `Inventory cost — ${sale.id.replace('sale-', '#').slice(0, 10)}`,
          amount: Number(cogs.toFixed(2)),
          payment_method: sale.payment_method,
          branch_name: sale.branch_name,
          notes: 'Auto-derived stock cost of the items sold at POS',
          performed_by: sale.cashier_name,
          created_at: sale.created_at,
          source: 'sale'
        });
      }
    });

    return rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [cashFlowEntries, displaySales, selectedBranchId, cfRange, cfTypeFilter, cfCategoryFilter, cfSearch]);

  const openNewCashFlowModal = () => {
    setEditingCashFlow(null);
    setCfForm({
      type: 'expense',
      title: '',
      amount: '',
      category: '',
      payment_method: 'cash',
      date: new Date().toISOString().slice(0, 16),
      branch_id: '',
      notes: ''
    });
    setCfFormError(null);
    setCfFormSuccess(null);
    setShowCashFlowModal(true);
  };

  const startEditCashFlow = (entry: CashFlowEntry) => {
    setEditingCashFlow(entry);
    setCfForm({
      type: entry.type,
      title: entry.title,
      amount: entry.amount.toString(),
      category: entry.category,
      payment_method: entry.payment_method,
      date: entry.created_at.slice(0, 16),
      branch_id: entry.branch_id || '',
      notes: entry.notes || ''
    });
    setCfFormError(null);
    setCfFormSuccess(null);
    setShowCashFlowModal(true);
  };

  const handleCashFlowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCfSubmitting) return;
    setCfFormError(null);
    setCfFormSuccess(null);

    const amountNum = parseFloat(cfForm.amount);
    if (!cfForm.title.trim()) {
      setCfFormError('Please enter a short title / description.');
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      setCfFormError('Please enter a valid amount greater than zero.');
      return;
    }
    if (!cfForm.category.trim()) {
      setCfFormError('Please select or enter a category.');
      return;
    }

    const selectedBranch = branches.find(b => b.id === cfForm.branch_id);
    const dateValue = cfForm.date ? new Date(cfForm.date).toISOString() : new Date().toISOString();

    setIsCfSubmitting(true);
    try {
      const payload = {
        type: cfForm.type,
        title: cfForm.title.trim(),
        amount: amountNum,
        category: cfForm.category.trim(),
        payment_method: cfForm.payment_method,
        branch_id: cfForm.branch_id || undefined,
        branch_name: selectedBranch ? selectedBranch.name : undefined,
        notes: cfForm.notes.trim() || undefined,
        performed_by: user.name,
        created_at: dateValue
      };

      if (editingCashFlow) {
        await dbService.cashFlow.update(editingCashFlow.id, payload);
        setCfFormSuccess('Cash flow entry updated successfully!');
      } else {
        await dbService.cashFlow.create(payload, user.name);
        setCfFormSuccess('Cash flow entry recorded successfully!');
      }

      await loadData();
      setTimeout(() => {
        setShowCashFlowModal(false);
        setEditingCashFlow(null);
        setCfForm({ type: 'expense', title: '', amount: '', category: '', payment_method: 'cash', date: '', branch_id: '', notes: '' });
        setCfFormSuccess(null);
        setIsCfSubmitting(false);
      }, 1000);
    } catch (err: any) {
      setCfFormError(err.message || 'Failed to save cash flow entry.');
      setIsCfSubmitting(false);
    }
  };

  const triggerDeleteCashFlow = (entry: CashFlowEntry) => {
    setDeleteConfirm({
      id: entry.id,
      type: 'cash-flow',
      title: 'Delete Cash Flow Entry?',
      description: `Are you sure you want to delete "${entry.title}" (${entry.type === 'income' ? 'income' : 'expense'}) worth ${formatCurrency(entry.amount)}? This action cannot be undone.`
    });
    setDeleteError(null);
  };

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
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `cash_flow_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast('Cash flow report exported to CSV.', 'success');
    } catch {
      toast('Failed to export cash flow report.', 'error');
    } finally {
      setIsCfExporting(false);
    }
  };

  // Cashier Sales Performance Metrics Calculation
  const cashierPerformanceList = useMemo(() => {
    return displayCashiers.map(cashier => {
      const cashierSales = displaySales.filter(s => 
        (s.cashier_id && s.cashier_id === cashier.id) ||
        (s.cashier_name && s.cashier_name.trim().toLowerCase() === cashier.name.trim().toLowerCase())
      );

      const totalRevenue = cashierSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const totalTransactions = cashierSales.length;
      const totalItemsSold = cashierSales.reduce((sum, s) => {
        return sum + (s.items ? s.items.reduce((iSum, item) => iSum + (item.quantity || 0), 0) : 0);
      }, 0);
      const avgReceipt = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
      const sortedSales = [...cashierSales].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const lastActive = sortedSales.length > 0 ? sortedSales[0].created_at : null;

      return {
        cashier,
        totalRevenue,
        totalTransactions,
        totalItemsSold,
        avgReceipt,
        lastActive,
        sales: sortedSales
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [displayCashiers, displaySales]);

  const topCashierPerf = cashierPerformanceList.length > 0 ? cashierPerformanceList[0] : null;
  const maxCashierRevenue = topCashierPerf && topCashierPerf.totalRevenue > 0 ? topCashierPerf.totalRevenue : 1;
  const totalCashierSalesVolume = cashierPerformanceList.reduce((acc, c) => acc + c.totalRevenue, 0);
  const totalCashierTxCount = cashierPerformanceList.reduce((acc, c) => acc + c.totalTransactions, 0);

  // Filtered Cashiers for Account Management
  const filteredCashiers = useMemo(() => {
    return displayCashiers.filter(c => {
      const q = cashierSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.branch_name && c.branch_name.toLowerCase().includes(q))
      );
    });
  }, [displayCashiers, cashierSearch]);

  // Handle Product CRUD submissions
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);
    setFormSuccess(null);

    const priceNum = parseFloat(productForm.price);
    const costNum = parseFloat(productForm.cost);
    const stockNum = parseInt(productForm.stock);
    const minStockNum = parseInt(productForm.min_stock_level);
    const unitAmountNum = parseFloat(productForm.unit_amount);

    if (!productForm.name || !productForm.sku || !productForm.category) {
      setFormError('Please fill out Name, SKU, and Category.');
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError('Please enter a valid sale price.');
      return;
    }
    if (isNaN(costNum) || costNum < 0) {
      setFormError('Please enter a valid cost price.');
      return;
    }
    if (isNaN(stockNum) || stockNum < 0) {
      setFormError('Please enter a valid stock count.');
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedBranch = branches.find(b => b.id === productForm.branch_id);
      const payload = {
        name: productForm.name,
        sku: productForm.sku.toUpperCase(),
        barcode: productForm.barcode || '',
        description: productForm.description || '',
        category: productForm.category,
        image: productForm.image || null,
        use_stock: productForm.use_stock,
        price: priceNum,
        cost: costNum,
        unit_amount: isNaN(unitAmountNum) || unitAmountNum <= 0 ? 1 : unitAmountNum,
        unit_name: productForm.unit_name || 'pcs',
        stock: stockNum,
        min_stock_level: isNaN(minStockNum) ? 5 : minStockNum,
        price_variant: productForm.price_variant || 'Standard',
        expiry_date: productForm.expiry_date || undefined,
        branch_id: productForm.branch_id || undefined,
        branch_name: selectedBranch ? selectedBranch.name : undefined
      };

      if (editingProduct) {
        await dbService.products.update(editingProduct.id, payload, user.name);
        setFormSuccess('Product updated successfully!');
        toast('Product updated successfully!', 'success');
      } else {
        await dbService.products.create(payload, user.name);
        setFormSuccess('Product created successfully!');
        toast('Product created successfully!', 'success');
      }

      await loadData();
      setTimeout(() => {
        setShowProductModal(false);
        setEditingProduct(null);
        setProductForm({
          name: '',
          sku: '',
          barcode: '',
          description: '',
          category: '',
          image: '',
          use_stock: true,
          price: '',
          cost: '',
          unit_amount: '1',
          unit_name: 'pcs',
          stock: '',
          min_stock_level: '5',
          price_variant: 'Standard',
          expiry_date: '',
          branch_id: ''
        });
        setFormSuccess(null);
        setIsSubmitting(false);
      }, 1000);
    } catch (err: any) {
      setFormError(err.message || 'Operation failed. Please verify unique SKU.');
      toast(err.message || 'Operation failed. Please verify unique SKU.', 'error');
      setIsSubmitting(false);
    }
  };

  const startEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name || '',
      sku: prod.sku || '',
      barcode: prod.barcode || '',
      description: prod.description || '',
      category: prod.category || '',
      image: prod.image || '',
      use_stock: prod.use_stock !== undefined ? prod.use_stock : true,
      price: prod.price !== undefined ? prod.price.toString() : '',
      cost: prod.cost !== undefined ? prod.cost.toString() : '',
      unit_amount: prod.unit_amount !== undefined ? prod.unit_amount.toString() : '1',
      unit_name: prod.unit_name || 'pcs',
      stock: prod.stock !== undefined ? prod.stock.toString() : '0',
      min_stock_level: prod.min_stock_level !== undefined ? prod.min_stock_level.toString() : '5',
      price_variant: prod.price_variant || 'Standard',
      expiry_date: prod.expiry_date || '',
      branch_id: prod.branch_id || ''
    });
    setFormError(null);
    setShowProductModal(true);
  };

  const triggerDeleteProduct = (id: string, name: string) => {
    setDeleteConfirm({
      id,
      type: 'product',
      title: 'Delete Product?',
      description: `Are you sure you want to delete "${name}"? Historical sales and stock audit logs for this item will be safely preserved.`
    });
    setDeleteError(null);
  };

  const triggerDeleteCashier = (id: string, name: string) => {
    setDeleteConfirm({
      id,
      type: 'cashier',
      title: 'Revoke Cashier Access?',
      description: `Are you sure you want to revoke staff access for "${name}"? Past sales transactions recorded by this cashier will remain intact.`
    });
    setDeleteError(null);
  };

  const triggerDeleteBranch = (id: string, name: string) => {
    setDeleteConfirm({
      id,
      type: 'branch',
      title: 'Delete Branch Outlet?',
      description: `Are you sure you want to delete branch outlet "${name}"? Cashiers and products currently assigned to this branch will become unassigned/global.`
    });
    setDeleteError(null);
  };

  const handleExecuteDelete = async () => {
    if (!deleteConfirm || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      if (deleteConfirm.type === 'branch') {
        await dbService.branches.delete(deleteConfirm.id);
      } else if (deleteConfirm.type === 'cashier') {
        await dbService.auth.deleteCashier(deleteConfirm.id);
      } else if (deleteConfirm.type === 'product') {
        await dbService.products.delete(deleteConfirm.id);
      } else if (deleteConfirm.type === 'cash-flow') {
        await dbService.cashFlow.delete(deleteConfirm.id);
      }
      await loadData();
      setDeleteConfirm(null);
    } catch (err: any) {
      console.error('Delete execution error:', err);
      setDeleteError(err.message || 'Failed to complete deletion. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Cashier Registration / Updates
  const handleCashierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);
    setFormSuccess(null);

    if (!cashierForm.name || !cashierForm.email) {
      setFormError('Please fill in cashier name and username/email.');
      return;
    }

    if (!editingCashier && !cashierForm.password) {
      setFormError('Please enter a password for the new cashier account.');
      return;
    }

    if (cashierForm.password && cashierForm.password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    const assignedBranch = branches.find(b => b.id === cashierForm.branch_id);

    setIsSubmitting(true);

    try {
      if (editingCashier) {
        const updates: Partial<UserProfile> = {
          name: cashierForm.name,
          email: formatEmailWithDefaultDomain(cashierForm.email),
          branch_id: cashierForm.branch_id || undefined,
          branch_name: assignedBranch ? assignedBranch.name : undefined
        };
        await dbService.auth.updateCashier(editingCashier.id, updates);
        setFormSuccess('Cashier credentials updated successfully!');
      } else {
        await dbService.auth.addCashier(
          formatEmailWithDefaultDomain(cashierForm.email), 
          cashierForm.name, 
          cashierForm.password,
          cashierForm.branch_id || undefined,
          assignedBranch ? assignedBranch.name : undefined
        );
        setFormSuccess('Cashier registered successfully!');
      }
      await loadData();
      setTimeout(() => {
        setShowCashierModal(false);
        setEditingCashier(null);
        setCashierForm({ name: '', email: '', password: '', branch_id: '' });
        setFormSuccess(null);
        setIsSubmitting(false);
      }, 1200);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save cashier account.');
      setIsSubmitting(false);
    }
  };

  // Branch CRUD handlers
  const handleBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);
    setFormSuccess(null);

    if (!branchForm.name || !branchForm.code || !branchForm.address || !branchForm.phone) {
      setFormError('Please fill in branch name, code, address, and contact phone.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingBranch) {
        await dbService.branches.update(editingBranch.id, {
          name: branchForm.name,
          code: branchForm.code.toUpperCase(),
          address: branchForm.address,
          phone: branchForm.phone,
          manager_name: branchForm.manager_name || undefined
        });
        setFormSuccess('Branch updated successfully!');
      } else {
        await dbService.branches.create({
          name: branchForm.name,
          code: branchForm.code.toUpperCase(),
          address: branchForm.address,
          phone: branchForm.phone,
          manager_name: branchForm.manager_name || undefined,
          is_active: true
        });
        setFormSuccess('Branch created successfully!');
      }

      await loadData();
      setTimeout(() => {
        setShowBranchModal(false);
        setEditingBranch(null);
        setBranchForm({ name: '', code: '', address: '', phone: '', manager_name: '' });
        setFormSuccess(null);
        setIsSubmitting(false);
      }, 1200);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save branch.');
      setIsSubmitting(false);
    }
  };

  const startEditBranch = (branch: Branch) => {
    setEditingBranch(branch);
    setBranchForm({
      name: branch.name,
      code: branch.code,
      address: branch.address,
      phone: branch.phone,
      manager_name: branch.manager_name || ''
    });
    setFormError(null);
    setShowBranchModal(true);
  };

  const handleToggleBranchStatus = async (branch: Branch) => {
    try {
      await dbService.branches.update(branch.id, { is_active: !branch.is_active });
      await loadData();
      toast(`Branch ${branch.name} ${branch.is_active ? 'deactivated' : 'activated'}.`, 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to update branch status.', 'error');
    }
  };

  // Unique categories for filters
  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(displayProducts.map(p => p.category)))];
  }, [displayProducts]);

  // Filtering Products List
  const filteredProducts = useMemo(() => {
    return displayProducts.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
                            p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
                            p.barcode.toLowerCase().includes(productSearch.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
      
      let matchesStock = true;
      if (stockFilter === 'Low Stock') {
        matchesStock = p.stock <= p.min_stock_level && p.stock > 0;
      } else if (stockFilter === 'Out of Stock') {
        matchesStock = p.stock === 0;
      }

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [displayProducts, productSearch, categoryFilter, stockFilter]);

  const totalProductPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE) || 1;
  const safeProductPage = Math.min(Math.max(1, productPage), totalProductPages);

  const paginatedProducts = useMemo(() => {
    const startIndex = (safeProductPage - 1) * PRODUCTS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);
  }, [filteredProducts, safeProductPage]);

  // Filtering logs
  const filteredTxs = useMemo(() => {
    return displayTxs.filter(tx => {
      return tx.product_name.toLowerCase().includes(txSearch.toLowerCase()) ||
             tx.performed_by.toLowerCase().includes(txSearch.toLowerCase()) ||
             tx.notes.toLowerCase().includes(txSearch.toLowerCase()) ||
             tx.type.toLowerCase().includes(txSearch.toLowerCase());
    });
  }, [displayTxs, txSearch]);

  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const mainTabs = ['overview', 'products', 'cashiers', 'cash-flow', 'branches'] as const;
  const moreTabs = ['staff-performance', 'transactions', 'settings'] as const;

  // Back button: each surface pops in the reverse order it was opened, so a
  // delete confirmation raised from inside a modal closes before that modal.
  useBackDismiss(showMoreMenu, () => setShowMoreMenu(false));
  useBackDismiss(showProductModal, () => setShowProductModal(false));
  useBackDismiss(showCashierModal, () => setShowCashierModal(false));
  useBackDismiss(showBranchModal, () => setShowBranchModal(false));
  useBackDismiss(showBarcodeModal, () => setShowBarcodeModal(false));
  useBackDismiss(showSqlModal, () => setShowSqlModal(false));
  useBackDismiss(showCsvModal, () => setShowCsvModal(false));
  useBackDismiss(restockProduct !== null, () => setRestockProduct(null));
  useBackDismiss(showCashFlowModal, () => setShowCashFlowModal(false));
  useBackDismiss(selectedCashierForHistory !== null, () => setSelectedCashierForHistory(null));
  useBackDismiss(deleteConfirm !== null, () => setDeleteConfirm(null));

  // Back retraces visited tabs and stops at Overview.
  useBackTabHistory(activeTab, setActiveTab, 'overview');

  return (
    <div className="h-full w-full bg-gradient-to-br from-slate-50 to-slate-100/80 flex flex-col select-none overflow-hidden">
      {/* Top App Bar - Android Material Design */}
      <header className="bg-white border-b border-slate-200/80 shrink-0 safe-area-top z-30">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            {businessProfile.logo_url ? (
              <img
                src={businessProfile.logo_url}
                alt="Logo"
                className="w-9 h-9 rounded-xl object-cover bg-white border border-slate-200 p-0.5 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center font-black text-lg text-white shadow-md shadow-indigo-500/20 shrink-0">
                {businessProfile.name ? businessProfile.name.charAt(0).toUpperCase() : 'M'}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-900 truncate">
                {activeTab === 'overview'
                  ? 'Dashboard'
                  : activeTab === 'cashiers'
                  ? 'Cashiers'
                  : activeTab === 'staff-performance'
                  ? 'Staff'
                  : activeTab === 'settings'
                  ? 'Branding'
                  : activeTab === 'transactions'
                  ? 'Audit Logs'
                  : activeTab === 'cash-flow'
                  ? 'Cash Flow'
                  : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </h1>
              <p className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full inline-block ${isSupabaseConfigured ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse-soft`} />
                {isSupabaseConfigured ? 'Cloud Connected' : 'Offline Mode'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'products' && (
              <button
                onClick={openNewProductModal}
                className="inline-flex items-center justify-center p-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 active:scale-95 text-white rounded-xl shadow-lg shadow-indigo-600/20 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4.5 h-4.5" />
              </button>
            )}
            {activeTab === 'cashiers' && (
              <button
                onClick={openNewCashierModal}
                className="inline-flex items-center justify-center p-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 active:scale-95 text-white rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4.5 h-4.5" />
              </button>
            )}
            {activeTab === 'branches' && (
              <button
                onClick={openNewBranchModal}
                className="inline-flex items-center justify-center p-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 active:scale-95 text-white rounded-xl shadow-lg shadow-indigo-600/20 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4.5 h-4.5" />
              </button>
            )}
            {activeTab === 'cash-flow' && (
              <button
                onClick={openNewCashFlowModal}
                className="inline-flex items-center justify-center p-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 active:scale-95 text-white rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4.5 h-4.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Content Body */}
        <div className="p-3 sm:p-6 md:p-8 flex-1 overflow-y-auto android-scroll">
          {isLoading || isTabChanging ? (
            <div className="space-y-6 animate-pulse">
              {/* Skeleton Header */}
              <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="h-5 w-48 bg-slate-200 rounded-lg" />
                  <div className="h-3 w-64 bg-slate-100 rounded-md" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-9 w-28 bg-slate-200 rounded-xl" />
                  <div className="h-9 w-32 bg-indigo-200/60 rounded-xl" />
                </div>
              </div>

              {/* Skeleton Metrics Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm space-y-3">
                    <div className="h-3 w-20 bg-slate-200 rounded" />
                    <div className="h-6 w-28 bg-slate-200 rounded-md" />
                  </div>
                ))}
              </div>

              {/* Skeleton Table / Cards List */}
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="bg-slate-50/80 p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="h-4 w-32 bg-slate-200 rounded" />
                  <div className="h-4 w-24 bg-slate-200 rounded" />
                  <div className="h-4 w-16 bg-slate-200 rounded" />
                </div>
                <div className="divide-y divide-slate-100">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-200 rounded-xl shrink-0" />
                        <div className="space-y-2">
                          <div className="h-4 w-40 bg-slate-200 rounded" />
                          <div className="h-3 w-24 bg-slate-100 rounded" />
                        </div>
                      </div>
                      <div className="h-4 w-20 bg-slate-200 rounded" />
                      <div className="h-6 w-24 bg-slate-100 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* OVERVIEW ANALYTICS TAB */}
              {activeTab === 'overview' && (
              <div className="space-y-8">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                  {[
                    { label: 'Total Revenue', value: formatCurrency(analytics.totalRevenue), icon: DollarSign, color: 'indigo' },
                    { label: 'Gross Profit', value: formatCurrency(analytics.totalProfit), icon: TrendingUp, color: analytics.totalProfit >= 0 ? 'emerald' : 'red' },
                    { label: 'Sales Transacted', value: `${analytics.totalSalesCount} Orders`, icon: ShoppingCart, color: 'sky' },
                    { label: 'Low Stock', value: `${analytics.lowStockCount} Items`, icon: AlertTriangle, color: analytics.lowStockCount > 0 ? 'amber' : 'slate' },
                  ].map((card, i) => (
                    <div key={i} className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-premium flex items-center justify-between card-hover">
                      <div className="min-w-0">
                        <span className="text-slate-400 text-[9px] sm:text-[10px] uppercase tracking-wider font-bold block truncate">{card.label}</span>
                        <h3 className={`text-sm sm:text-lg md:text-xl font-extrabold mt-1 truncate ${
                          card.color === 'emerald' ? 'text-emerald-600' : 
                          card.color === 'red' ? 'text-red-600' : 
                          card.color === 'amber' ? 'text-amber-600' : 
                          'text-slate-900'
                        }`}>
                          {card.value}
                        </h3>
                      </div>
                      <div className={`p-2 sm:p-3 rounded-xl shrink-0 ml-1 shadow-sm ${
                        card.color === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
                        card.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                        card.color === 'sky' ? 'bg-sky-50 text-sky-600' :
                        card.color === 'amber' ? 'bg-amber-50 text-amber-600' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        <card.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Charts Area */}
                <div className="grid lg:grid-cols-3 gap-6">
                  {/* Sales & Profit Chart */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm lg:col-span-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                      <div>
                        <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                          <span>Daily Sales & Profit Performance</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100/80">
                            Supabase Realtime
                          </span>
                        </h4>
                        <p className="text-[10px] text-slate-400">Past 7 days revenue and gross profit trends</p>
                      </div>
                    </div>

                    {/* Recharts Responsive Line Chart */}
                    <div className="w-full h-64 pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analytics.salesOverTime} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            stroke="#94a3b8" 
                            fontSize={11} 
                            tickLine={false} 
                            axisLine={{ stroke: '#e2e8f0' }} 
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
                                      📅 {label}
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
                                    {payload[0]?.payload?.count !== undefined && (
                                      <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                                        Orders Completed: <span className="text-slate-200 font-bold">{payload[0].payload.count} sales</span>
                                      </p>
                                    )}
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
                            dataKey="revenue" 
                            name="Revenue" 
                            stroke="#4f46e5" 
                            strokeWidth={3} 
                            dot={{ r: 4, fill: '#4f46e5', stroke: '#ffffff', strokeWidth: 2 }} 
                            activeDot={{ r: 7, fill: '#4f46e5', stroke: '#ffffff', strokeWidth: 2 }} 
                          />
                          <Line 
                            type="monotone" 
                            dataKey="profit" 
                            name="Gross Profit" 
                            stroke="#10b981" 
                            strokeWidth={3} 
                            dot={{ r: 4, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }} 
                            activeDot={{ r: 7, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }} 
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Top Selling Products List */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">Top Selling Products</h4>
                      <p className="text-[10px] text-slate-400 mb-5">Ranked by overall gross sales volume</p>

                      {analytics.topProducts.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-xs">No product sales logged yet.</div>
                      ) : (
                        <div className="space-y-4">
                          {analytics.topProducts.map((prod, idx) => {
                            const maxRev = Math.max(...analytics.topProducts.map(p => p.revenue), 1);
                            const percent = (prod.revenue / maxRev) * 100;
                            return (
                              <div key={idx} className="space-y-1.5">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-semibold text-slate-700 truncate max-w-[150px]">{prod.name}</span>
                                  <span className="font-bold text-slate-900">{formatCurrency(prod.revenue)} <span className="font-normal text-[10px] text-slate-400">({prod.quantity} sold)</span></span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-4 mt-4">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Low Inventory Alerts:</span>
                        <span className={`font-bold px-2 py-0.5 rounded ${analytics.lowStockCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                          {analytics.lowStockCount} items
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Row - Category Sales & Cashier Leaderboard */}
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Category Sales */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
                    <h4 className="font-bold text-sm text-slate-800 mb-5 flex items-center space-x-2">
                      <Layers className="w-4 h-4 text-slate-400" />
                      <span>Product Category Revenue breakdown</span>
                    </h4>
                    {analytics.categorySales.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs">No category analytics recorded yet.</div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {analytics.categorySales.map((cat, idx) => {
                          const totalCatSum = analytics.categorySales.reduce((sum, c) => sum + c.value, 0);
                          const percent = ((cat.value / totalCatSum) * 100).toFixed(1);
                          const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-pink-500', 'bg-teal-500', 'bg-rose-500'];
                          const bgCol = colors[idx % colors.length];

                          return (
                            <div key={idx} className="p-3.5 bg-slate-50 rounded-lg border border-slate-100 flex flex-col justify-between">
                              <span className="text-xs font-semibold text-slate-500 truncate">{cat.category}</span>
                              <div className="mt-2 flex items-baseline justify-between">
                                <h5 className="font-extrabold text-slate-900 text-xs sm:text-sm">{formatCurrency(cat.value)}</h5>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${bgCol}`}>{percent}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Cashier Sales Leaderboard */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                          <Users className="w-4 h-4 text-indigo-600" />
                          <span>Cashier Sales Leaderboard</span>
                        </h4>
                        <button
                          onClick={() => setActiveTab('cashiers')}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          View All →
                        </button>
                      </div>

                      {cashierPerformanceList.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-xs">No cashier sales recorded yet.</div>
                      ) : (
                        <div className="space-y-3.5">
                          {cashierPerformanceList.slice(0, 4).map((perf, idx) => {
                            const percent = maxCashierRevenue > 0 ? (perf.totalRevenue / maxCashierRevenue) * 100 : 0;
                            const medal = idx === 0 ? '🏆' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;

                            return (
                              <div key={perf.cashier.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100/80 flex items-center justify-between gap-3">
                                <div className="flex items-center space-x-3 min-w-0">
                                  <span className="text-xs font-bold w-6 text-center text-slate-500 shrink-0">{medal}</span>
                                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                                    {perf.cashier.name ? perf.cashier.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'C'}
                                  </div>
                                  <div className="min-w-0">
                                    <h5 className="font-bold text-slate-900 text-xs truncate">{perf.cashier.name}</h5>
                                    <p className="text-[10px] text-slate-400 font-medium">{perf.totalTransactions} Sales • {perf.totalItemsSold} Items</p>
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <span className="font-extrabold text-slate-900 text-xs block">{formatCurrency(perf.totalRevenue)}</span>
                                  <div className="w-20 bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden ml-auto">
                                    <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${percent}%` }} />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CASH FLOW ANALYTICS TAB */}
            {activeTab === 'cash-flow' && (
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
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold text-[11px] sm:text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
                        title="Add a new income or expense entry"
                      >
                        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="truncate">Add Entry</span>
                      </button>
                    </div>
                  </div>

                  {/* Filters with smooth animation */}
                  <div
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 overflow-hidden transition-all duration-300 ease-in-out"
                    style={{
                      maxHeight: showCfFilters ? '500px' : '0',
                      opacity: showCfFilters ? 1 : 0,
                      marginTop: showCfFilters ? 0 : '-8px',
                    }}
                  >
                    {/* Date Range Segmented Control */}
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Period</span>
                      <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
                        {([
                          ['today', 'Today'],
                          ['7d', '7 Days'],
                          ['30d', '30 Days'],
                          ['month', 'Month'],
                          ['all', 'All']
                        ] as const).map(([val, label]) => (
                          <button
                            key={val}
                            onClick={() => setCfRange(val)}
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              cfRange === val
                                ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
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
                                ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200'
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

                    {/* Search */}
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Search</span>
                      <div className="relative">
                        <Search className="absolute inset-y-0 left-0 pl-3 w-4 h-4 my-auto text-slate-400" />
                        <input
                          type="text"
                          placeholder="Title, category, notes..."
                          value={cfSearch}
                          onChange={(e) => setCfSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
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
                          card.color === 'emerald' ? 'text-emerald-600' :
                          card.color === 'red' ? 'text-red-600' :
                          'text-slate-900'
                        }`}>
                          {card.value}
                        </h3>
                        <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium mt-1 truncate">{card.sub}</p>
                      </div>
                      <div className={`p-2 sm:p-3 rounded-xl shrink-0 ml-1 shadow-sm ${
                        card.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
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
                          {block.type === 'income' ? <ArrowUpRight className="w-4 h-4 text-emerald-500" /> : <ArrowDownLeft className="w-4 h-4 text-red-500" />}
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
                                      className={`${block.accent === 'emerald' ? 'bg-emerald-500' : 'bg-red-500'} h-full rounded-full transition-all duration-500`}
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
                        className="mt-2 text-emerald-600 font-bold hover:underline flex items-center gap-1"
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
                                <span className={`font-mono font-bold text-xs shrink-0 ${row.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {row.type === 'income' ? '+' : '−'}{formatCurrency(row.amount)}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${
                                  row.type === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {row.type}
                                </span>
                                <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[8px] font-bold">{row.category}</span>
                                {row.source === 'sale' && (
                                  <span className="inline-flex px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[8px] font-bold">POS Auto</span>
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
                                    className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
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
                                      row.type === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                      {row.type}
                                    </span>
                                    {row.source === 'sale' && (
                                      <span className="ml-1.5 inline-flex px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[9px] font-bold">POS Auto</span>
                                    )}
                                  </td>
                                  <td className="p-3.5 font-semibold text-slate-700">{row.category}</td>
                                  <td className="p-3.5 font-bold text-slate-900">
                                    <span className="block max-w-[200px] truncate" title={row.title}>{row.title}</span>
                                    {row.notes && <span className="text-[10px] text-slate-400 font-normal italic block max-w-[200px] truncate">{row.notes}</span>}
                                  </td>
                                  <td className={`p-3.5 text-right font-mono font-bold whitespace-nowrap ${row.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
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
                                            className="p-1.5 hover:bg-indigo-50 text-indigo-600 hover:text-indigo-800 rounded transition-colors cursor-pointer"
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
            )}

            {/* PRODUCT CATALOG & STOCK CONTROLLER */}
            {activeTab === 'products' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden w-full max-w-full min-w-0">
                <div className="p-4 sm:p-6 border-b border-slate-200/90 bg-gradient-to-b from-white to-slate-50/60">
                  {/* Secondary Action Tools Row */}
                  <div className="grid grid-cols-3 sm:flex sm:items-center sm:justify-end gap-2">
                    <button
                      onClick={() => setShowCsvModal(true)}
                      className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] sm:text-xs rounded-xl border border-emerald-200/80 transition-all cursor-pointer active:scale-95"
                      title="Import inventory items from CSV file"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                      <span className="truncate">Import CSV</span>
                    </button>

                    <button
                      onClick={handleExportCsv}
                      className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] sm:text-xs rounded-xl border border-slate-200 transition-all cursor-pointer active:scale-95 shadow-2xs"
                      title="Export current inventory list to CSV"
                    >
                      <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 shrink-0" />
                      <span className="truncate">Export CSV</span>
                    </button>

                    <button
                      onClick={() => openBarcodePrintModal()}
                      className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 bg-indigo-50/70 hover:bg-indigo-100/80 text-indigo-700 font-bold text-[11px] sm:text-xs rounded-xl border border-indigo-200/70 transition-all cursor-pointer active:scale-95"
                      title="Generate and print barcode sticker labels for inventory"
                    >
                      <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 shrink-0" />
                      <span className="truncate">Barcodes</span>
                    </button>
                  </div>
                </div>

                {/* Filters Row */}
                <div className="p-3 sm:p-4 bg-slate-50/80 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  <div className="relative">
                    <Search className="absolute inset-y-0 left-0 pl-3 w-4 h-4 my-auto text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search Name, SKU, or Barcode..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:contents gap-2">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs">
                      <span className="text-[11px] sm:text-xs text-slate-500 font-bold shrink-0">Category:</span>
                      <SearchableCategorySelect
                        options={categories.map(cat => ({
                          value: cat,
                          label: cat,
                          count: cat === 'All' ? products.length : products.filter(p => p.category === cat).length
                        }))}
                        value={categoryFilter}
                        onChange={(val) => setCategoryFilter(val)}
                        className="w-full"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs">
                      <span className="text-[11px] sm:text-xs text-slate-500 font-bold shrink-0">Stock Status:</span>
                      <select
                        value={stockFilter}
                        onChange={(e) => setStockFilter(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl py-2 px-2 font-medium text-slate-800 text-xs focus:outline-none shadow-2xs"
                      >
                        <option value="All">All Stocks</option>
                        <option value="Low Stock">Low Stock Warnings</option>
                        <option value="Out of Stock">Out of Stock</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Product Table & Mobile Cards */}
                <div className="p-0">
                  {filteredProducts.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                      <Package className="w-8 h-8 text-slate-300" />
                      <span>No inventory products found matching your search.</span>
                      <button
                        onClick={() => setShowCsvModal(true)}
                        className="mt-2 text-indigo-600 font-bold hover:underline flex items-center gap-1"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Import CSV Items</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Mobile Cards View */}
                      <div className="grid grid-cols-1 gap-3 sm:hidden p-4">
                        {paginatedProducts.map((prod) => {
                          const isLowStock = prod.stock <= prod.min_stock_level;
                          const isOutOfStock = prod.stock === 0;

                          return (
                            <div key={prod.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                              <div className="flex justify-between items-start">
                                <div className="min-w-0">
                                  <h4 className="font-bold text-slate-950 text-xs">{prod.name}</h4>
                                  {prod.barcode && <p className="text-[9px] text-slate-400 font-mono">BC: {prod.barcode}</p>}
                                </div>
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-[9px] font-semibold text-slate-600 shrink-0">
                                  {prod.category}
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-2 py-2 border-t border-b border-slate-100">
                                <div>
                                  <p className="text-[8px] text-slate-400 uppercase font-bold">Purchased Price</p>
                                  <p className="font-mono text-[11px] text-slate-600 font-medium">{formatCurrency(prod.cost)}</p>
                                </div>
                                <div>
                                  <p className="text-[8px] text-slate-400 uppercase font-bold">Unit Price</p>
                                  <p className="font-mono text-[11px] text-slate-900 font-bold">{formatCurrency(prod.price)}</p>
                                </div>
                                <div>
                                  <p className="text-[8px] text-slate-400 uppercase font-bold">Stock</p>
                                  <span className={`inline-block font-mono text-[10px] font-bold ${
                                    isOutOfStock 
                                      ? 'text-red-600' 
                                      : isLowStock 
                                        ? 'text-amber-600' 
                                        : 'text-emerald-600'
                                  }`}>
                                    {prod.stock} {prod.unit_name || 'ခု'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex justify-between items-center pt-1">
                                <div className="text-[9px] font-medium">
                                  {isOutOfStock ? (
                                    <span className="text-red-600 font-bold">Reorder Immediately</span>
                                  ) : isLowStock ? (
                                    <span className="text-amber-600">Low (≤{prod.min_stock_level})</span>
                                  ) : (
                                    <span className="text-emerald-600">Stock OK</span>
                                  )}
                                </div>

                                <div className="flex items-center space-x-1.5">
                                  <button
                                    onClick={() => openBarcodePrintModal(prod.id)}
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold"
                                    title="Print Barcode Label"
                                  >
                                    <Printer className="w-3 h-3 text-indigo-600" />
                                    <span>Barcode</span>
                                  </button>
                                  <button
                                    onClick={() => startEditProduct(prod)}
                                    className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    onClick={() => openQuickRestock(prod)}
                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold"
                                  >
                                    <PackagePlus className="w-3 h-3" />
                                    <span>Restock</span>
                                  </button>
                                  <button
                                    onClick={() => triggerDeleteProduct(prod.id, prod.name)}
                                    className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Spreadsheet Table View */}
                      <div className="hidden sm:block w-full max-w-full overflow-x-auto border-t border-slate-200">
                        <table className="w-full text-left text-xs border-collapse font-sans min-w-[1400px]">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider sticky top-0 z-10">
                              <th className="p-2.5 border-r border-slate-200 w-52 min-w-[180px] max-w-[240px]">Name</th>
                              <th className="p-2.5 border-r border-slate-200 w-16 text-center">Image</th>
                              <th className="p-2.5 border-r border-slate-200 w-44 min-w-[150px] max-w-[200px]">Description</th>
                              <th className="p-2.5 border-r border-slate-200 w-28 min-w-[100px]">Category</th>
                              <th className="p-2.5 border-r border-slate-200 w-20 text-center">Use Stock</th>
                              <th className="p-2.5 border-r border-slate-200 w-32 text-right">Purchased Price</th>
                              <th className="p-2.5 border-r border-slate-200 w-24 text-center">Unit Amount</th>
                              <th className="p-2.5 border-r border-slate-200 w-32 text-right">Unit Price</th>
                              <th className="p-2.5 border-r border-slate-200 w-24 text-center">Unit Name</th>
                              <th className="p-2.5 border-r border-slate-200 w-20 text-center">Stock</th>
                              <th className="p-2.5 border-r border-slate-200 w-28">Price Variant</th>
                              <th className="p-2.5 border-r border-slate-200 w-28">Expiry Date</th>
                              <th className="p-2.5 border-r border-slate-200 w-36">Updated Date</th>
                              <th className="p-2.5 border-r border-slate-200 w-32">Barcode</th>
                              <th className="p-2.5 text-center w-24">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {paginatedProducts.map((prod) => {
                              const isLowStock = prod.stock <= prod.min_stock_level;
                              const isOutOfStock = prod.stock === 0;

                              return (
                                <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                                  {/* Name */}
                                  <td className="p-2.5 font-bold text-slate-900 border-r border-slate-100 truncate max-w-[240px]" title={prod.name}>
                                    {prod.name}
                                  </td>

                                  {/* Image */}
                                  <td className="p-3 text-center border-r border-slate-100">
                                    {prod.image && prod.image !== 'null' ? (
                                      <img src={prod.image} alt={prod.name} className="w-8 h-8 rounded object-cover mx-auto border border-slate-200" />
                                    ) : (
                                      <span className="text-slate-400 font-mono text-[10px]">null</span>
                                    )}
                                  </td>

                                  {/* Description */}
                                  <td className="p-3 text-slate-600 border-r border-slate-100 truncate max-w-[160px]" title={prod.description}>
                                    {prod.description || '-'}
                                  </td>

                                  {/* Category */}
                                  <td className="p-3 border-r border-slate-100 font-semibold text-slate-700">
                                    <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px]">
                                      {prod.category}
                                    </span>
                                  </td>

                                  {/* Use Stock */}
                                  <td className="p-3 text-center border-r border-slate-100 font-mono text-[11px]">
                                    <span className={prod.use_stock !== false ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                                      {prod.use_stock !== false ? 'true' : 'false'}
                                    </span>
                                  </td>

                                  {/* Purchased Price */}
                                  <td className="p-3 text-right font-mono text-slate-600 border-r border-slate-100 font-medium">
                                    {prod.cost ? prod.cost.toLocaleString() : '0'}
                                  </td>

                                  {/* Unit Amount */}
                                  <td className="p-3 text-center font-mono text-slate-700 border-r border-slate-100">
                                    {prod.unit_amount || 1}
                                  </td>

                                  {/* Unit Price */}
                                  <td className="p-3 text-right font-mono font-bold text-slate-900 border-r border-slate-100">
                                    {prod.price ? prod.price.toLocaleString() : '0'}
                                  </td>

                                  {/* Unit Name */}
                                  <td className="p-3 text-center font-bold text-indigo-700 border-r border-slate-100">
                                    {prod.unit_name || 'ခု'}
                                  </td>

                                  {/* Stock */}
                                  <td className="p-3 text-center border-r border-slate-100">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                                      isOutOfStock 
                                        ? 'bg-red-100 text-red-800' 
                                        : isLowStock 
                                          ? 'bg-amber-100 text-amber-800' 
                                          : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                      {prod.stock}
                                    </span>
                                  </td>

                                  {/* Price Variant */}
                                  <td className="p-3 text-slate-500 border-r border-slate-100">
                                    {prod.price_variant || '-'}
                                  </td>

                                  {/* Expiry Date */}
                                  <td className="p-3 text-slate-500 border-r border-slate-100">
                                    {prod.expiry_date || '-'}
                                  </td>

                                  {/* Updated Date */}
                                  <td className="p-3 text-slate-500 border-r border-slate-100 whitespace-nowrap text-[11px]">
                                    {prod.updated_at || (prod.created_at ? new Date(prod.created_at).toLocaleTimeString() + ' ' + new Date(prod.created_at).toLocaleDateString() : '-')}
                                  </td>

                                  {/* Barcode */}
                                  <td className="p-3 font-mono text-slate-600 border-r border-slate-100 whitespace-nowrap">
                                    {prod.barcode || '-'}
                                  </td>

                                  {/* Actions */}
                                  <td className="p-3 text-center">
                                    <div className="flex items-center justify-center space-x-1">
                                      <button
                                        onClick={() => openBarcodePrintModal(prod.id)}
                                        className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded transition-colors cursor-pointer"
                                        title="Print Barcode Label"
                                      >
                                        <Printer className="w-3.5 h-3.5 text-indigo-600" />
                                      </button>
                                      <button
                                        onClick={() => startEditProduct(prod)}
                                        className="p-1.5 hover:bg-indigo-50 text-indigo-600 hover:text-indigo-800 rounded transition-colors cursor-pointer"
                                        title="Edit Details & Adjust Stock"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => openQuickRestock(prod)}
                                        className="p-1.5 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-800 rounded transition-colors cursor-pointer"
                                        title="Quick Restock"
                                      >
                                        <PackagePlus className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => triggerDeleteProduct(prod.id, prod.name)}
                                        className="p-1.5 hover:bg-red-50 text-red-600 hover:text-red-800 rounded transition-colors cursor-pointer"
                                        title="Delete Product"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Bar */}
                      {filteredProducts.length > 0 && (
                        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                          <div className="text-slate-500 font-medium text-center sm:text-left">
                            Showing <span className="font-bold text-slate-800">{((safeProductPage - 1) * PRODUCTS_PER_PAGE) + 1}</span> to <span className="font-bold text-slate-800">{Math.min(safeProductPage * PRODUCTS_PER_PAGE, filteredProducts.length)}</span> of <span className="font-bold text-slate-800">{filteredProducts.length}</span> products
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              disabled={safeProductPage === 1}
                              onClick={() => setProductPage(p => Math.max(1, p - 1))}
                              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                            >
                              <ChevronLeft className="w-4 h-4" />
                              <span>Prev</span>
                            </button>

                            <div className="flex items-center gap-1 px-1">
                              {Array.from({ length: totalProductPages }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === totalProductPages || Math.abs(p - safeProductPage) <= 1)
                                .reduce<(number | string)[]>((acc, page, idx, arr) => {
                                  if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                                    acc.push('...');
                                  }
                                  acc.push(page);
                                  return acc;
                                }, [])
                                .map((item, idx) => (
                                  typeof item === 'number' ? (
                                    <button
                                      key={idx}
                                      onClick={() => setProductPage(item)}
                                      className={`w-8 h-8 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                                        safeProductPage === item
                                          ? 'bg-indigo-600 text-white shadow-xs'
                                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-2xs'
                                      }`}
                                    >
                                      {item}
                                    </button>
                                  ) : (
                                    <span key={idx} className="px-1 text-slate-400 font-bold">...</span>
                                  )
                                ))
                              }
                            </div>

                            <button
                              disabled={safeProductPage >= totalProductPages}
                              onClick={() => setProductPage(p => Math.min(totalProductPages, p + 1))}
                              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                            >
                              <span>Next</span>
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* CASHIER ACCOUNTS MANAGEMENT TAB */}
            {activeTab === 'cashiers' && (
              <div className="space-y-4 sm:space-y-6">
                {/* Top Control Bar */}
                <div className="relative w-full">
                  <Search className="absolute inset-y-0 left-0 pl-3.5 w-4 h-4 my-auto text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search cashier name or email..."
                    value={cashierSearch}
                    onChange={(e) => setCashierSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
                  />
                </div>

                {/* Cashier Credentials Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="px-4 py-4 sm:px-5 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Cashier Credentials & Branch Outlets</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Manage cashier login usernames, passwords, and assigned store branches.</p>
                    </div>
                    <span className="self-start sm:self-auto text-xs font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">
                      {filteredCashiers.length} Accounts
                    </span>
                  </div>

                  {filteredCashiers.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 text-xs flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700 text-sm">No Cashiers Found</p>
                        <p className="text-slate-400 text-xs mt-0.5">No cashier accounts match your search or filter criteria.</p>
                      </div>
                      <button
                        onClick={openNewCashierModal}
                        className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 px-4 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Cashier Account</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Mobile Card View */}
                      <div className="block sm:hidden divide-y divide-slate-100">
                        {filteredCashiers.map((cashier) => (
                          <div key={cashier.id} className="p-4 flex flex-col gap-3 hover:bg-slate-50/60 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-extrabold text-xs uppercase shrink-0">
                                  {cashier.name ? cashier.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'C'}
                                </div>
                                <div>
                                  <span className="font-bold text-slate-900 block">{cashier.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">ID: {cashier.id.slice(0, 8)}...</span>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase border border-emerald-100">
                                {cashier.role || 'cashier'}
                              </span>
                            </div>
                            
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex flex-col gap-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Username / Email</span>
                                <span className="font-mono text-slate-700 font-medium text-xs truncate max-w-[180px]">{cashier.email}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Branch</span>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-slate-700 font-bold text-[11px] border border-slate-200">
                                  <Building2 className="w-3 h-3 text-indigo-500" />
                                  <span>{cashier.branch_name || 'All Branches'}</span>
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                onClick={() => startEditCashier(cashier)}
                                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                                <span>Edit Account</span>
                              </button>
                              <button
                                onClick={() => triggerDeleteCashier(cashier.id, cashier.name)}
                                className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors font-bold text-xs border border-red-100 cursor-pointer flex items-center justify-center"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table View */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                              <th className="py-3 px-4">Cashier Name</th>
                              <th className="py-3 px-4">Username / Email</th>
                              <th className="py-3 px-4">Assigned Branch</th>
                              <th className="py-3 px-4">Role</th>
                              <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {filteredCashiers.map((cashier) => (
                              <tr key={cashier.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-extrabold text-xs uppercase shrink-0">
                                      {cashier.name ? cashier.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'C'}
                                    </div>
                                    <div>
                                      <span className="font-bold text-slate-900 block">{cashier.name}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">ID: {cashier.id.slice(0, 8)}...</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 font-mono text-slate-700 font-medium">
                                  {cashier.email}
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200">
                                    <Building2 className="w-3 h-3 text-indigo-500" />
                                    <span>{cashier.branch_name || 'All Branches'}</span>
                                  </span>
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase border border-emerald-100">
                                    {cashier.role || 'cashier'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => startEditCashier(cashier)}
                                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-bold text-xs flex items-center gap-1 cursor-pointer"
                                      title="Edit Cashier Username, Password or Branch"
                                    >
                                      <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                                      <span className="hidden sm:inline">Edit Account</span>
                                    </button>
                                    <button
                                      onClick={() => triggerDeleteCashier(cashier.id, cashier.name)}
                                      className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors font-bold text-xs border border-red-100 cursor-pointer"
                                      title="Revoke Cashier Account"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* STAFF PERFORMANCE ANALYTICS TAB */}
            {activeTab === 'staff-performance' && (
              <div className="space-y-6">
                {/* Summary KPI Cards for Cashier Performance */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Staff</span>
                      <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">{displayCashiers.length} Cashiers</h3>
                    </div>
                    <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Top Performer</span>
                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900 mt-1 truncate max-w-[120px]">
                        {topCashierPerf ? topCashierPerf.cashier.name : 'N/A'}
                      </h3>
                      {topCashierPerf && (
                        <p className="text-[10px] text-emerald-600 font-bold">{formatCurrency(topCashierPerf.totalRevenue)}</p>
                      )}
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
                      <Award className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Staff Revenue</span>
                      <h3 className="text-sm sm:text-lg font-extrabold text-emerald-600 mt-1">{formatCurrency(totalCashierSalesVolume)}</h3>
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
                      <DollarSign className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">POS Receipts</span>
                      <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">{totalCashierTxCount} Orders</h3>
                    </div>
                    <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
                      <Receipt className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Main Cashier List & Sales Performance Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {cashierPerformanceList.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 text-xs flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Award className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700 text-sm">No Performance Metrics Recorded</p>
                        <p className="text-slate-400 text-xs mt-0.5">No registered cashiers or sales activity match the current branch filter.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {cashierPerformanceList.map((item, idx) => {
                        const percentOfMax = maxCashierRevenue > 0 ? (item.totalRevenue / maxCashierRevenue) * 100 : 0;
                        const rankLabel = idx === 0 ? '🏆 #1 Top Seller' : idx === 1 ? '🥈 #2 Rank' : idx === 2 ? '🥉 #3 Rank' : `#${idx + 1} Rank`;
                        const rankBg = idx === 0 
                          ? 'bg-amber-100 text-amber-800 border-amber-200' 
                          : idx === 1 
                            ? 'bg-slate-200 text-slate-800 border-slate-300' 
                            : idx === 2 
                              ? 'bg-orange-100 text-orange-800 border-orange-200' 
                              : 'bg-slate-100 text-slate-600 border-slate-200';

                        return (
                          <div key={item.cashier.id} className="p-4 sm:p-5 hover:bg-slate-50/60 transition-all space-y-4">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                              {/* Left: Avatar & Info */}
                              <div className="flex items-start sm:items-center space-x-3 min-w-0">
                                <div className="w-11 h-11 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-extrabold text-sm uppercase shrink-0 shadow-2xs">
                                  {item.cashier.name ? item.cashier.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'C'}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="font-extrabold text-slate-900 text-sm sm:text-base truncate">{item.cashier.name}</h4>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${rankBg}`}>
                                      {rankLabel}
                                    </span>
                                    <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 shrink-0">
                                      📍 {item.cashier.branch_name || 'Global'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">{item.cashier.email}</p>
                                </div>
                              </div>

                              {/* Right: Revenue Stats & Actions */}
                              <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-0 border-slate-100">
                                <div className="text-left lg:text-right">
                                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Total Revenue</span>
                                  <span className="font-black text-slate-900 text-base sm:text-lg">{formatCurrency(item.totalRevenue)}</span>
                                  <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden mt-1 lg:ml-auto">
                                    <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${percentOfMax}%` }} />
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setSelectedCashierForHistory({ cashier: item.cashier, sales: item.sales })}
                                    className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-indigo-100"
                                    title="View receipt history for this cashier"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Sales Receipts ({item.totalTransactions})</span>
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Detailed Performance Metrics Bar */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50/80 p-3 rounded-xl border border-slate-200/60 text-xs">
                              <div>
                                <span className="text-[10px] text-slate-400 font-semibold block">Total Sales Count</span>
                                <span className="font-bold text-slate-800">{item.totalTransactions} Transactions</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 font-semibold block">Items Sold Volume</span>
                                <span className="font-bold text-slate-800">{item.totalItemsSold} Units</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 font-semibold block">Avg Receipt Value</span>
                                <span className="font-bold text-slate-800">{formatCurrency(item.avgReceipt)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 font-semibold block">Last Active Sale</span>
                                <span className="font-bold text-slate-800 font-mono text-[11px]">
                                  {item.lastActive ? new Date(item.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(item.lastActive).toLocaleDateString() : 'No sales recorded'}
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
            )}

            {/* SYSTEM AUDIT & TRANSACTION LOGS */}
            {activeTab === 'transactions' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-200 flex justify-end">
                  <div className="relative max-w-xs w-full">
                    <Search className="absolute inset-y-0 left-0 pl-3 w-4 h-4 my-auto text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter by product, action, or staff..."
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
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
                                    ? 'bg-blue-100 text-blue-800'
                                    : tx.type === 'sale'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {tx.type}
                                </span>
                              </div>

                              <div className="flex justify-between items-start">
                                <h4 className="font-bold text-slate-900 text-xs">{tx.product_name}</h4>
                                <span className={`font-mono font-bold text-xs shrink-0 ${
                                  isAdd ? 'text-blue-600' : isSub ? 'text-amber-600' : 'text-slate-600'
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
                                        ? 'bg-blue-100 text-blue-800'
                                        : tx.type === 'sale'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-amber-100 text-amber-800'
                                    }`}>
                                      {tx.type}
                                    </span>
                                  </td>
                                  <td className="p-4 text-center">
                                    <span className={`font-mono font-bold ${
                                      isAdd ? 'text-blue-600' : isSub ? 'text-amber-600' : 'text-slate-600'
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
            )}
            {/* BRANCH OUTLETS TAB */}
            {activeTab === 'branches' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {branches.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-xs flex flex-col items-center justify-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 text-sm">No Branches Registered</p>
                      <p className="text-slate-400 text-xs mt-0.5">Create a branch outlet to group cashiers, inventory, and sales.</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {branches.map((branch) => {
                      const branchCashiersCount = cashiers.filter(c => c.branch_id === branch.id).length;
                      const branchSalesCount = sales.filter(s => s.branch_id === branch.id).length;
                      const branchRevenue = sales
                        .filter(s => s.branch_id === branch.id)
                        .reduce((sum, s) => sum + s.total_amount, 0);

                      return (
                        <div key={branch.id} className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                          <div>
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-800 text-[10px] font-mono font-bold rounded uppercase border border-slate-200">
                                  {branch.code}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 ${
                                  branch.is_active 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${branch.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                  <span>{branch.is_active ? 'Active' : 'Inactive'}</span>
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => startEditBranch(branch)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors"
                                  title="Edit Branch"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => triggerDeleteBranch(branch.id, branch.name)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-50 rounded-lg transition-colors"
                                  title="Delete Branch"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <h4 className="font-bold text-slate-900 text-sm mt-2">{branch.name}</h4>
                            
                            <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                              <p className="flex items-start gap-1.5 text-[11px]">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{branch.address}</span>
                              </p>
                              <p className="flex items-center gap-1.5 text-[11px] font-mono">
                                <span>📞</span>
                                <span>{branch.phone}</span>
                              </p>
                              {branch.manager_name && (
                                <p className="text-[11px] text-slate-500 pt-1">
                                  Manager: <strong className="text-slate-800">{branch.manager_name}</strong>
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-center">
                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <span className="text-[9px] text-slate-400 uppercase font-bold block">Assigned Staff</span>
                              <span className="text-xs font-bold text-slate-800">{branchCashiersCount} Cashiers</span>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <span className="text-[9px] text-slate-400 uppercase font-bold block">Branch Sales</span>
                              <span className="text-xs font-bold text-indigo-600">{formatCurrency(branchRevenue)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* BUSINESS PROFILE & BRANDING SETTINGS TAB */}
            {activeTab === 'settings' && (
              <div className="space-y-6 max-w-6xl mx-auto">
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-400/30">
                      <Store className="w-3.5 h-3.5" />
                      <span>Store Identity & Branding</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-extrabold tracking-tight">Business Profile & Logo Management</h3>
                    <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                      Manage your business name, logo, contact details, currency symbol, and custom receipt notes. Changes reflect instantly on POS receipts and navigation headers.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setBusinessForm(businessProfile);
                      setBusinessSuccessMsg(null);
                      setBusinessErrorMsg(null);
                    }}
                    className="self-start md:self-auto px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Reset Changes</span>
                  </button>
                </div>

                {/* Notifications */}
                {businessSuccessMsg && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-xs animate-fade-in">
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>{businessSuccessMsg}</span>
                  </div>
                )}

                {businessErrorMsg && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-bold flex items-center gap-2 shadow-xs animate-fade-in">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                    <span>{businessErrorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleBusinessSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Form Settings */}
                  <div className="lg:col-span-7 space-y-6">
                    {/* Card 1: Store Name & Logo */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-5">
                      <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-indigo-600" />
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-sm">Business Identity & Branding</h4>
                          <p className="text-[11px] text-slate-400">Set your store's display name, slogan, and logo image</p>
                        </div>
                      </div>

                      {/* Business Name Field */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Business Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={businessForm.name}
                          onChange={(e) => setBusinessForm({ ...businessForm, name: e.target.value })}
                          placeholder="e.g. RetailHub Supermart"
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                        />
                      </div>

                      {/* Tagline / Subtitle */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Store Tagline / Slogan
                        </label>
                        <input
                          type="text"
                          value={businessForm.tagline || ''}
                          onChange={(e) => setBusinessForm({ ...businessForm, tagline: e.target.value })}
                          placeholder="e.g. Quality Everyday Groceries & Mart"
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                        />
                      </div>

                      {/* Business Logo Section */}
                      <div className="space-y-3 pt-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Business Logo
                        </label>

                        <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                          {/* Logo Preview */}
                          <div className="w-20 h-20 rounded-2xl bg-white border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0 shadow-xs relative group">
                            {businessForm.logo_url ? (
                              <img
                                src={businessForm.logo_url}
                                alt="Logo Preview"
                                className="w-full h-full object-cover p-1"
                              />
                            ) : (
                              <div className="flex flex-col items-center text-slate-400">
                                <Image className="w-7 h-7 mb-0.5" />
                                <span className="text-[9px] font-bold">No Logo</span>
                              </div>
                            )}
                          </div>

                          <div className="flex-1 space-y-2 text-center sm:text-left w-full">
                            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                              {/* Upload File Button */}
                              <label className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                                <Upload className="w-3.5 h-3.5" />
                                <span>Upload Image File</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleLogoFileUpload}
                                  className="hidden"
                                />
                              </label>

                              {businessForm.logo_url && (
                                <button
                                  type="button"
                                  onClick={() => setBusinessForm({ ...businessForm, logo_url: '' })}
                                  className="px-3 py-2 bg-white hover:bg-red-50 text-red-600 border border-slate-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Remove Logo</span>
                                </button>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400">
                              Supported formats: PNG, JPG, WEBP, SVG (Max size: 3MB).
                            </p>
                          </div>
                        </div>

                        {/* Image URL Direct Input */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Or paste Image Web URL:
                          </label>
                          <input
                            type="url"
                            value={businessForm.logo_url || ''}
                            onChange={(e) => setBusinessForm({ ...businessForm, logo_url: e.target.value })}
                            placeholder="https://example.com/logo.png"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white"
                          />
                        </div>

                        {/* Preset Sample Logos */}
                        <div className="pt-2">
                          <label className="block text-[11px] font-bold text-slate-600 mb-2">
                            Quick Sample Vector Logos:
                          </label>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { label: 'Shop Blue', icon: '🛍️', bg: 'bg-blue-500' },
                              { label: 'Cart Emerald', icon: '🛒', bg: 'bg-emerald-500' },
                              { label: 'Mart Amber', icon: '🏪', bg: 'bg-amber-500' },
                              { label: 'Store Purple', icon: '✨', bg: 'bg-indigo-600' }
                            ].map((preset, idx) => {
                              const svgData = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%234F46E5"/><text x="50" y="60" font-size="45" text-anchor="middle" fill="white">${preset.icon}</text></svg>`;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setBusinessForm({ ...businessForm, logo_url: svgData })}
                                  className="p-2 border border-slate-200 hover:border-indigo-500 bg-slate-50 rounded-xl flex flex-col items-center text-center transition-all cursor-pointer group"
                                >
                                  <span className="text-xl group-hover:scale-110 transition-transform">{preset.icon}</span>
                                  <span className="text-[9px] font-bold text-slate-600 mt-1">{preset.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Contact & Receipt Options */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
                      <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-indigo-600" />
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-sm">Receipt & Contact Details</h4>
                          <p className="text-[11px] text-slate-400">Configure store contact information and receipt details</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Phone Number
                          </label>
                          <input
                            type="text"
                            value={businessForm.phone || ''}
                            onChange={(e) => setBusinessForm({ ...businessForm, phone: e.target.value })}
                            placeholder="+95 9 123 456 789"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Email Address
                          </label>
                          <input
                            type="email"
                            value={businessForm.email || ''}
                            onChange={(e) => setBusinessForm({ ...businessForm, email: e.target.value })}
                            placeholder="info@yourshop.com"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Store Address
                        </label>
                        <input
                          type="text"
                          value={businessForm.address || ''}
                          onChange={(e) => setBusinessForm({ ...businessForm, address: e.target.value })}
                          placeholder="No. 123 Main Road, Yangon, Myanmar"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Currency Symbol / Text
                          </label>
                          <input
                            type="text"
                            value={businessForm.currency || 'Ks'}
                            onChange={(e) => setBusinessForm({ ...businessForm, currency: e.target.value })}
                            placeholder="Ks, $, MMK"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Default Tax Rate (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={businessForm.tax_rate ?? 5}
                            onChange={(e) => setBusinessForm({ ...businessForm, tax_rate: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Printed Receipt Footer Note
                        </label>
                        <textarea
                          rows={2}
                          value={businessForm.receipt_footer || ''}
                          onChange={(e) => setBusinessForm({ ...businessForm, receipt_footer: e.target.value })}
                          placeholder="Thank you for shopping with us! Please come again."
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs text-slate-900 focus:outline-none focus:border-indigo-600 resize-none"
                        />
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={businessSaving}
                        className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {businessSaving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Saving Changes...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Save Business Profile & Logo</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Real-Time Live Receipts & Header Preview */}
                  <div className="lg:col-span-5 space-y-6">
                    {/* Live Receipt Card */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4 sticky top-24">
                      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-indigo-600" />
                          <h4 className="font-extrabold text-slate-900 text-xs">Live Receipt Preview</h4>
                        </div>
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold text-[9px] rounded-full uppercase">
                          Real-Time POS
                        </span>
                      </div>

                      {/* Mock Thermal Receipt Box */}
                      <div className="bg-slate-100 p-4 rounded-xl font-mono text-[11px] text-slate-800 leading-relaxed shadow-inner border border-slate-200">
                        <div className="bg-white p-4 border border-slate-200 rounded-md space-y-3 shadow-2xs relative">
                          {/* Top Logo & Header */}
                          <div className="text-center space-y-1">
                            {businessForm.logo_url ? (
                              <img
                                src={businessForm.logo_url}
                                alt="Logo Preview"
                                className="w-12 h-12 object-contain mx-auto rounded-lg mb-1"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-indigo-600 text-white font-black text-lg rounded-xl flex items-center justify-center mx-auto shadow-xs mb-1">
                                {businessForm.name ? businessForm.name.charAt(0).toUpperCase() : 'R'}
                              </div>
                            )}

                            <h4 className="font-black text-xs uppercase text-slate-900 tracking-tight">
                              {businessForm.name || 'Your Business Name'}
                            </h4>

                            {businessForm.tagline && (
                              <p className="text-[9px] font-sans text-slate-500 font-medium">
                                {businessForm.tagline}
                              </p>
                            )}

                            {businessForm.address && (
                              <p className="text-[9px] text-slate-400 leading-tight">
                                📍 {businessForm.address}
                              </p>
                            )}

                            {businessForm.phone && (
                              <p className="text-[9px] text-slate-400">
                                📞 {businessForm.phone}
                              </p>
                            )}
                          </div>

                          {/* Order Metadata */}
                          <div className="border-t border-dashed border-slate-300 pt-2 text-[9px] space-y-0.5 text-slate-500">
                            <div className="flex justify-between">
                              <span>Receipt #:</span>
                              <span className="font-bold text-slate-700">RCP-2026-8819</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Date:</span>
                              <span>{new Date().toLocaleDateString()}</span>
                            </div>
                          </div>

                          {/* Items */}
                          <div className="border-t border-dashed border-slate-300 pt-2 space-y-1">
                            <div className="flex justify-between font-bold text-slate-900 text-[9px]">
                              <span>Sample Item</span>
                              <span>Amount</span>
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-700">
                              <span>1x Premium Product A</span>
                              <span>12,000 {businessForm.currency || 'Ks'}</span>
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-700">
                              <span>2x Essential Goods B</span>
                              <span>8,000 {businessForm.currency || 'Ks'}</span>
                            </div>
                          </div>

                          {/* Total */}
                          <div className="border-t border-dashed border-slate-300 pt-2 text-[9px] space-y-1">
                            <div className="flex justify-between text-slate-500">
                              <span>Subtotal:</span>
                              <span>20,000 {businessForm.currency || 'Ks'}</span>
                            </div>
                            <div className="flex justify-between font-black text-slate-900 text-xs pt-1 border-t border-dotted border-slate-300">
                              <span>TOTAL DUE:</span>
                              <span className="text-indigo-600">20,000 {businessForm.currency || 'Ks'}</span>
                            </div>
                          </div>

                          {/* Footer */}
                          <div className="border-t border-dashed border-slate-300 pt-2 text-center">
                            <p className="text-[9px] text-slate-500 italic">
                              "{businessForm.receipt_footer || 'Thank you for shopping with us!'}"
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Database Setup Card */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
                      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-emerald-600" />
                          <div>
                            <h4 className="font-extrabold text-slate-900 text-xs">Supabase Database Setup</h4>
                            <p className="text-[10px] text-slate-400">Run this SQL in your Supabase SQL Editor</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${isSupabaseConfigured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {isSupabaseConfigured ? 'Connected' : 'Not Connected'}
                        </span>
                      </div>

                      <button
                        onClick={handleCopySql}
                        className={`w-full px-4 py-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 shadow-sm ${
                          copiedSql
                            ? 'bg-emerald-600 text-white'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                      >
                        {copiedSql ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedSql ? 'Copied to Clipboard!' : '1-Tap Copy Full SQL Schema'}</span>
                      </button>

                      <button
                        onClick={handleDownloadSql}
                        className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download .sql File</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
        </div>
      </main>

      {/* PRODUCT ADD/EDIT MODAL DIALOG */}
      {showProductModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-premium-xl border border-slate-100 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/80">
              <h3 className="font-extrabold text-slate-900 flex items-center space-x-2 text-sm sm:text-base">
                <Package className="w-5 h-5 text-indigo-600" />
                <span>{editingProduct ? 'Edit Product Schema Details' : 'Register New Product'}</span>
              </h3>
              <button
                onClick={() => { setShowProductModal(false); setEditingProduct(null); }}
                className="text-slate-400 hover:text-slate-700 font-bold p-1 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProductSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && !e.defaultPrevented) e.preventDefault(); }} className="flex flex-col flex-1 overflow-hidden min-h-0 text-xs">
              <div className="p-5 overflow-y-auto space-y-5 flex-1">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 flex items-start space-x-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                    <span>{formError}</span>
                  </div>
                )}
                {formSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 flex items-start space-x-1.5">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                    <span>{formSuccess}</span>
                  </div>
                )}

                {/* SECTION 1: BASIC INFORMATION */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-indigo-900 font-bold text-[11px] uppercase tracking-wider border-b border-slate-100 pb-1">
                    <Tag className="w-3.5 h-3.5 text-indigo-600" />
                    <span>1. Product Identification & Metadata</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Product Name *</label>
                      <input
                        type="text"
                        required
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        placeholder="e.g. Organic Whole Milk 1L"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="flex items-center justify-between text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        <span>SKU Identifier *</span>
                        {!editingProduct && (
                          <span className="text-indigo-500 normal-case tracking-normal font-semibold">Auto-generated</span>
                        )}
                      </label>
                      <input
                        type="text"
                        required
                        disabled={!!editingProduct}
                        value={isGeneratingCodes && !productForm.sku ? 'Generating…' : productForm.sku}
                        onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                        placeholder="MILK-ORG-1L"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 disabled:opacity-50 font-mono font-bold text-indigo-900 uppercase"
                      />
                    </div>

                    <div>
                      <label className="flex items-center justify-between text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        <span>Barcode Number</span>
                        {!editingProduct && (
                          <span className="text-indigo-500 normal-case tracking-normal font-semibold">Sequential</span>
                        )}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={isGeneratingCodes && !productForm.barcode ? 'Generating…' : productForm.barcode}
                          onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                          placeholder="e.g. 000123"
                          className="flex-1 min-w-0 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono"
                        />
                        {!editingProduct && (
                          <button
                            type="button"
                            onClick={fillGeneratedCodes}
                            disabled={isGeneratingCodes}
                            title="Generate a fresh SKU and the next available barcode"
                            className="p-2.5 shrink-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <RefreshCw className={`w-4 h-4 ${isGeneratingCodes ? 'animate-spin' : ''}`} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Category *</label>
                      <SearchableCategorySelect
                        options={categories.filter(cat => cat !== 'All').map(cat => ({ value: cat, label: cat }))}
                        value={productForm.category}
                        onChange={(value) => setProductForm({ ...productForm, category: value })}
                        placeholder="Select or create category..."
                        allowCreate
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Price Variant Tag</label>
                      <input
                        type="text"
                        value={productForm.price_variant}
                        onChange={(e) => setProductForm({ ...productForm, price_variant: e.target.value })}
                        placeholder="Standard, Retail, Wholesale, VIP"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Product Image URL</label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={productForm.image}
                          onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
                          placeholder="https://images.unsplash.com/... or image path"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                        />
                        {productForm.image && (
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-100 flex items-center justify-center">
                            <img src={productForm.image} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Product Description</label>
                      <textarea
                        rows={2}
                        value={productForm.description}
                        onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                        placeholder="Provide additional details, brand notes, or specs..."
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: PRICING & UNITS */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-indigo-900 font-bold text-[11px] uppercase tracking-wider border-b border-slate-100 pb-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    <span>2. Pricing & Packaging Unit Specifications</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Purchased Cost (Ks) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={productForm.cost}
                        onChange={(e) => setProductForm({ ...productForm, cost: e.target.value })}
                        placeholder="0.00"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-amber-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Unit Sale Price (Ks) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                        placeholder="0.00"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-black text-emerald-700"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Unit Quantity Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={productForm.unit_amount}
                        onChange={(e) => setProductForm({ ...productForm, unit_amount: e.target.value })}
                        placeholder="1"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Unit Packaging Name</label>
                      <input
                        type="text"
                        value={productForm.unit_name}
                        onChange={(e) => setProductForm({ ...productForm, unit_name: e.target.value })}
                        placeholder="pcs, box, kg, bottle, pack"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 3: INVENTORY TRACKING & OUTLET */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                    <div className="flex items-center gap-1.5 text-indigo-900 font-bold text-[11px] uppercase tracking-wider">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      <span>3. Inventory Stock Control & Store Outlet</span>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={productForm.use_stock}
                        onChange={(e) => setProductForm({ ...productForm, use_stock: e.target.checked })}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-700">Track Stock Inventory</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Current Stock Count *</label>
                      <input
                        type="number"
                        min="0"
                        required
                        disabled={!productForm.use_stock}
                        value={productForm.stock}
                        onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                        placeholder="0"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 disabled:opacity-50 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Min Alert Stock Level</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={productForm.min_stock_level}
                        onChange={(e) => setProductForm({ ...productForm, min_stock_level: e.target.value })}
                        placeholder="5"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Product Expiry Date</label>
                      <input
                        type="date"
                        value={productForm.expiry_date}
                        onChange={(e) => setProductForm({ ...productForm, expiry_date: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Branch Outlet Assignment</label>
                      <select
                        value={productForm.branch_id}
                        onChange={(e) => setProductForm({ ...productForm, branch_id: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
                      >
                        <option value="">🏢 Global Inventory / All Store Outlets</option>
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>
                            📍 {b.name} ({b.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* PINNED MODAL FOOTER */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3 shrink-0">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => { setShowProductModal(false); setEditingProduct(null); }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isGeneratingCodes}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Package className="w-4 h-4" />
                      <span>{editingProduct ? 'Save Product Schema Updates' : 'Add to Product Catalog'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REGISTER CASHIER MODAL DIALOG */}
      {showCashierModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-premium-xl border border-slate-100 max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                  {editingCashier ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">{editingCashier ? 'Edit Cashier Account' : 'Register New Cashier'}</h3>
                  <p className="text-[10px] text-slate-400">{editingCashier ? 'Update cashier login credentials' : 'Create login credentials for store staff'}</p>
                </div>
              </div>
              <button
                onClick={() => { setShowCashierModal(false); setEditingCashier(null); }}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg hover:bg-slate-50 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCashierSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 flex items-start space-x-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  <span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-700 flex items-start space-x-1.5">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={cashierForm.name}
                  onChange={(e) => setCashierForm({ ...cashierForm, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Username / Email</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={cashierForm.email}
                    onChange={(e) => setCashierForm({ ...cashierForm, email: e.target.value })}
                    placeholder="e.g. cashier1"
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-medium"
                  />
                  {!cashierForm.email.includes('@') && cashierForm.email.trim() !== '' && (
                    <span className="absolute inset-y-0 right-3 flex items-center text-[10px] text-slate-400 font-medium">
                      @pos.com
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Password {editingCashier && <span className="text-slate-400 lowercase">(Leave empty to keep current)</span>}</label>
                <input
                  type="password"
                  required={!editingCashier}
                  value={cashierForm.password}
                  onChange={(e) => setCashierForm({ ...cashierForm, password: e.target.value })}
                  placeholder={editingCashier ? "Leave blank to keep current" : "Minimum 6 characters"}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Assigned Branch Outlet</label>
                <select
                  value={cashierForm.branch_id}
                  onChange={(e) => setCashierForm({ ...cashierForm, branch_id: e.target.value })}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="">🏢 Unassigned / Global</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      📍 {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-indigo-50/60 border border-indigo-100/80 rounded-lg text-[11px] text-indigo-900 space-y-1">
                <p className="font-bold flex items-center gap-1 text-indigo-950">
                  <span>🔑 Staff Login Info</span>
                </p>
                <p className="text-[10px] text-indigo-600/90">{editingCashier ? 'Update the cashier login credentials.' : 'The cashier will use their email and this custom password to log in.'}</p>
              </div>

              <div className="pt-3 flex justify-end space-x-2.5 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => { setShowCashierModal(false); setEditingCashier(null); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      {editingCashier ? <Edit2 className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                      <span>{editingCashier ? 'Save Account Changes' : 'Create Staff Account'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REGISTER / EDIT BRANCH MODAL DIALOG */}
      {showBranchModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-premium-xl border border-slate-100 max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">{editingBranch ? 'Edit Branch Outlet' : 'Register New Branch Outlet'}</h3>
                  <p className="text-[10px] text-slate-400">Configure physical branch location & contact info</p>
                </div>
              </div>
              <button
                onClick={() => { setShowBranchModal(false); setEditingBranch(null); }}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg hover:bg-slate-50 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBranchSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 flex items-start space-x-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  <span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-700 flex items-start space-x-1.5">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Branch Name</label>
                <input
                  type="text"
                  required
                  value={branchForm.name}
                  onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                  placeholder="e.g. Mandalay City Mall Branch"
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Branch Code (Unique)</label>
                <input
                  type="text"
                  required
                  value={branchForm.code}
                  onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })}
                  placeholder="e.g. MDY-02"
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-medium uppercase"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Physical Address</label>
                <textarea
                  required
                  rows={2}
                  value={branchForm.address}
                  onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                  placeholder="Street address, Township, City"
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={branchForm.phone}
                    onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                    placeholder="09-12345678"
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Manager Name (Opt)</label>
                  <input
                    type="text"
                    value={branchForm.manager_name}
                    onChange={(e) => setBranchForm({ ...branchForm, manager_name: e.target.value })}
                    placeholder="e.g. U Zaw Zaw"
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2.5 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => { setShowBranchModal(false); setEditingBranch(null); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{editingBranch ? 'Update Branch' : 'Register Branch'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPABASE SQL SCHEMA MODAL */}
      {showSqlModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-premium-xl border border-slate-100 max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-xs">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Supabase Database Setup SQL</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Run this script in Supabase Dashboard SQL Editor</p>
                </div>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              <div className="p-3 bg-indigo-50/80 border border-indigo-100 rounded-xl space-y-1.5 text-indigo-950">
                <p className="font-bold text-xs flex items-center gap-1.5 text-indigo-900">
                  <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>How to apply to Supabase:</span>
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-indigo-900 font-medium leading-relaxed pl-1">
                  <li>Tap <strong>1-Tap Copy SQL</strong> or <strong>Download SQL File</strong> below.</li>
                  <li>Open your <strong>Supabase Dashboard</strong> in browser: <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="underline font-bold text-indigo-700">supabase.com/dashboard</a></li>
                  <li>Navigate to your project &apos;s <strong>SQL Editor</strong> tab (left sidebar icon with `&gt;_`).</li>
                  <li>Paste this SQL code and tap <strong>Run</strong> (or press Ctrl/Cmd+Enter).</li>
                </ol>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SQL Schema Code</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopySql}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs ${
                      copiedSql
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {copiedSql ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSql ? 'Copied!' : '1-Tap Copy SQL'}</span>
                  </button>
                  <button
                    onClick={handleDownloadSql}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <pre className="bg-slate-900 text-slate-100 p-3.5 rounded-xl text-[10px] font-mono overflow-x-auto max-h-60 leading-relaxed select-all">
                  <code>{SUPABASE_SCHEMA_SQL}</code>
                </pre>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BARCODE PRINTING MODAL */}
      <BarcodePrintModal
        isOpen={showBarcodeModal}
        onClose={() => setShowBarcodeModal(false)}
        products={products}
        selectedProductId={barcodeProductId}
        currencySymbol={businessProfile.currency || 'Ks'}
        businessName={businessProfile.name}
      />

      {/* CASH FLOW ADD / EDIT ENTRY MODAL */}
      {showCashFlowModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-premium-xl border border-slate-100 max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/80">
              <h3 className="font-extrabold text-slate-900 flex items-center space-x-2 text-sm sm:text-base">
                <Wallet className="w-5 h-5 text-emerald-600" />
                <span>{editingCashFlow ? 'Edit Cash Flow Entry' : 'Record Cash Flow Entry'}</span>
              </h3>
              <button
                onClick={() => { setShowCashFlowModal(false); setEditingCashFlow(null); }}
                className="text-slate-400 hover:text-slate-700 font-bold p-1 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCashFlowSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0 text-xs">
              <div className="p-5 overflow-y-auto space-y-5 flex-1">
                {cfFormError && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 flex items-start space-x-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                    <span>{cfFormError}</span>
                  </div>
                )}
                {cfFormSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 flex items-start space-x-1.5">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                    <span>{cfFormSuccess}</span>
                  </div>
                )}

                {/* Type Toggle */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Transaction Type *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCfForm(prev => ({ ...prev, type: 'income' }))}
                      className={`py-2.5 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        cfForm.type === 'income'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      <span>Income</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCfForm(prev => ({ ...prev, type: 'expense' }))}
                      className={`py-2.5 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        cfForm.type === 'expense'
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <ArrowDownLeft className="w-4 h-4" />
                      <span>Expense</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Title / Description *</label>
                    <input
                      type="text"
                      required
                      value={cfForm.title}
                      onChange={(e) => setCfForm({ ...cfForm, title: e.target.value })}
                      placeholder={cfForm.type === 'income' ? 'e.g. Shop rental income' : 'e.g. Monthly electricity bill'}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Amount (Ks) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={cfForm.amount}
                      onChange={(e) => setCfForm({ ...cfForm, amount: e.target.value })}
                      placeholder="0"
                      className={`w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold font-mono ${
                        cfForm.type === 'income' ? 'text-emerald-700 focus:border-emerald-500' : 'text-red-700 focus:border-red-500'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Date & Time</label>
                    <input
                      type="datetime-local"
                      value={cfForm.date}
                      onChange={(e) => setCfForm({ ...cfForm, date: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Category *</label>
                    <input
                      type="text"
                      required
                      list="cf-category-options"
                      value={cfForm.category}
                      onChange={(e) => setCfForm({ ...cfForm, category: e.target.value })}
                      placeholder="Select or type a category..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
                    />
                    <datalist id="cf-category-options">
                      {(cfForm.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Payment Method</label>
                    <div className="grid grid-cols-4 gap-1">
                      {(['cash', 'card', 'mobile', 'bank'] as const).map(method => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setCfForm(prev => ({ ...prev, payment_method: method }))}
                          className={`py-2 rounded-lg border text-[9px] font-bold uppercase transition-all cursor-pointer ${
                            cfForm.payment_method === method
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Branch</label>
                    <select
                      value={cfForm.branch_id}
                      onChange={(e) => setCfForm({ ...cfForm, branch_id: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
                    >
                      <option value="">All / Head Office</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Notes</label>
                    <textarea
                      rows={2}
                      value={cfForm.notes}
                      onChange={(e) => setCfForm({ ...cfForm, notes: e.target.value })}
                      placeholder="Optional reference, receipt number, or extra detail..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 bg-slate-50/60 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowCashFlowModal(false); setEditingCashFlow(null); }}
                  disabled={isCfSubmitting}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCfSubmitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isCfSubmitting ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingCashFlow ? 'Save Changes' : 'Save Entry'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-premium-xl border border-slate-100 max-w-sm w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-start space-x-3">
              <div className="p-2.5 bg-red-50 rounded-xl text-red-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">{deleteConfirm.title}</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{deleteConfirm.description}</p>
              </div>
            </div>

            {deleteError && (
              <div className="p-2.5 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => { setDeleteConfirm(null); setDeleteError(null); }}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleExecuteDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CASHIER SALES RECEIPTS HISTORY MODAL */}
      {selectedCashierForHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-premium-xl border border-slate-100 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-sm">
                  {selectedCashierForHistory.cashier.name ? selectedCashierForHistory.cashier.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'C'}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                    Sales History — {selectedCashierForHistory.cashier.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedCashierForHistory.cashier.email} • {selectedCashierForHistory.sales.length} Total Receipts Handled
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCashierForHistory(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Sales list */}
            <div className="p-5 overflow-y-auto space-y-3.5 flex-1 bg-slate-50/30">
              {selectedCashierForHistory.sales.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No sales receipts logged by this cashier yet.
                </div>
              ) : (
                selectedCashierForHistory.sales.map((sale) => (
                  <div key={sale.id} className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {sale.id}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                          sale.payment_method === 'cash' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          sale.payment_method === 'card' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-purple-50 text-purple-700 border-purple-200'
                        }`}>
                          {sale.payment_method}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(sale.created_at).toLocaleString()}
                      </span>
                    </div>

                    {/* Receipt Items Preview */}
                    <div className="space-y-1 text-xs">
                      {sale.items && sale.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-slate-700 text-[11px]">
                          <span>{item.quantity}x {item.product_name}</span>
                          <span className="font-mono font-semibold">{formatCurrency(item.total)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-500">
                        {sale.customer_name ? `Customer: ${sale.customer_name}` : 'Walk-in Customer'}
                      </span>
                      <span className="font-black text-slate-900 text-sm">
                        Total: {formatCurrency(sale.total_amount)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700">
                Grand Total: {formatCurrency(selectedCashierForHistory.sales.reduce((sum, s) => sum + s.total_amount, 0))}
              </span>
              <button
                onClick={() => setSelectedCashierForHistory(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        onImportSuccess={handleImportCsvSuccess}
        branches={branches}
        defaultBranchId={user.branch_id || ''}
        defaultBranchName={user.branch_name || ''}
      />

      <QuickRestockModal
        product={restockProduct}
        isOpen={restockProduct !== null}
        onClose={() => setRestockProduct(null)}
        onRestock={handleQuickRestock}
      />

      {/* Bottom Navigation Bar - Android Material Design */}
      <nav className="bg-white border-t border-slate-200/80 shrink-0 safe-area-bottom z-40">
        <div className="flex items-stretch h-16">
          {mainTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabSwitch(tab)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 cursor-pointer nav-item-tap relative ${
                activeTab === tab ? 'text-indigo-600' : 'text-slate-500'
              }`}
            >
              {activeTab === tab && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-indigo-600 rounded-full" />
              )}
              {tab === 'overview' && <TrendingUp className="w-5 h-5" />}
              {tab === 'products' && <Package className="w-5 h-5" />}
              {tab === 'cashiers' && <Users className="w-5 h-5" />}
              {tab === 'cash-flow' && <Wallet className="w-5 h-5" />}
              {tab === 'branches' && <Building2 className="w-5 h-5" />}
              <span className="text-[10px] font-bold capitalize">
                {tab === 'overview' ? 'Home' : tab === 'products' ? 'Products' : tab === 'cashiers' ? 'Staff' : tab === 'cash-flow' ? 'Cash Flow' : 'Stores'}
              </span>
            </button>
          ))}
          <button
            onClick={() => setShowMoreMenu(true)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 cursor-pointer nav-item-tap relative ${
              moreTabs.includes(activeTab as any) ? 'text-indigo-600' : 'text-slate-500'
            }`}
          >
            {moreTabs.includes(activeTab as any) && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-indigo-600 rounded-full" />
            )}
            <Settings className="w-5 h-5" />
            <span className="text-[10px] font-bold">More</span>
          </button>
        </div>
      </nav>

      {/* More Menu Bottom Sheet */}
      {showMoreMenu && (
        <div className="bottom-sheet-overlay" onClick={() => setShowMoreMenu(false)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="pt-3 pb-2">
              <div className="pull-indicator" />
            </div>
            <div className="px-4 pb-3 flex items-center justify-between border-b border-slate-100">
              <h4 className="font-bold text-sm text-slate-900">More Options</h4>
              <button onClick={() => setShowMoreMenu(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-1">
              <button
                onClick={() => { handleTabSwitch('staff-performance'); setShowMoreMenu(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all cursor-pointer active-scale ${
                  activeTab === 'staff-performance' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Award className="w-5 h-5 text-indigo-500" />
                <span>Staff Performance</span>
              </button>
              <button
                onClick={() => { handleTabSwitch('transactions'); setShowMoreMenu(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all cursor-pointer active-scale ${
                  activeTab === 'transactions' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Clipboard className="w-5 h-5 text-indigo-500" />
                <span>Audit Logs & History</span>
              </button>
              <button
                onClick={() => { handleTabSwitch('settings'); setShowMoreMenu(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all cursor-pointer active-scale ${
                  activeTab === 'settings' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Store className="w-5 h-5 text-indigo-500" />
                <span>Business & Branding</span>
              </button>

              <div className="border-t border-slate-100 my-2" />

              <button
                onClick={() => { setShowSqlModal(true); setShowMoreMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer active-scale"
              >
                <Database className="w-5 h-5 text-emerald-500" />
                <span>Supabase SQL Setup</span>
              </button>
              <button
                onClick={() => { setShowCsvModal(true); setShowMoreMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer active-scale"
              >
                <FileSpreadsheet className="w-5 h-5 text-amber-500" />
                <span>Import Products CSV</span>
              </button>

              <div className="border-t border-slate-100 my-2" />

              <button
                onClick={() => { if (confirm('Are you sure you want to log out?')) onLogout(); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-all cursor-pointer active-scale"
              >
                <LogOut className="w-5 h-5" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
