export type UserRole = 'owner' | 'cashier';

export interface BusinessProfile {
  name: string;
  tagline?: string;
  logo_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_rate?: number;
  receipt_footer?: string;
  currency?: string;
  updated_at?: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  manager_id?: string;
  manager_name?: string;
  is_active: boolean;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password?: string;
  branch_id?: string;
  branch_name?: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  price: number; // Unit Price
  cost: number; // Purchased Price
  stock: number;
  min_stock_level: number;
  category: string;
  image?: string | null;
  description?: string;
  use_stock?: boolean;
  unit_amount?: number;
  unit_name?: string;
  price_variant?: string;
  expiry_date?: string;
  updated_at?: string;
  branch_id?: string;
  branch_name?: string;
  created_at: string;
}

export interface Sale {
  id: string;
  cashier_id: string;
  cashier_name: string;
  branch_id?: string;
  branch_name?: string;
  total_amount: number;
  discount: number;
  payment_method: 'cash' | 'card' | 'mobile';
  customer_name?: string;
  customer_phone?: string;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  total: number;
}

export interface SaleWithItems extends Sale {
  items: SaleItem[];
}

export interface InventoryTransaction {
  id: string;
  product_id: string;
  product_name: string;
  branch_id?: string;
  branch_name?: string;
  type: 'stock-in' | 'stock-out' | 'sale' | 'adjustment';
  quantity: number;
  notes: string;
  performed_by: string;
  created_at: string;
}

export type CashFlowType = 'income' | 'expense';
export type PaymentMethod = 'cash' | 'card' | 'mobile' | 'bank';

export interface CashFlowEntry {
  id: string;
  type: CashFlowType;
  category: string;
  title: string;
  amount: number;
  payment_method: PaymentMethod;
  branch_id?: string;
  branch_name?: string;
  notes?: string;
  performed_by: string;
  created_at: string;
}

// New type for cashier request to void or edit a sale
export interface SaleRequest {
  id: string; // UUID
  saleId: string;
  type: 'void' | 'edit';
  requestedBy: string; // user.id
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  // additional payload for edit could be added later
}

export interface SalesAnalytics {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalSalesCount: number;
  lowStockCount: number;
  salesOverTime: { date: string; revenue: number; profit: number; count: number }[];
  categorySales: { category: string; value: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
}

export interface LabelConfig {
  paperMode: 'sticker' | 'receipt';
  paperWidth: '32' | '58' | '80';
  labelWidth: string;
  labelHeight: string;
  barcodeWidth: string;
  barcodeHeight: string;
  barcodeType: 'CODE39' | 'CODE128' | 'EAN13' | 'EAN8' | 'UPCA' | 'UPCE' | 'ITF' | 'CODE93';
  cutMode: 'off' | 'full' | 'partial';
  labelGap: string;
  feedOffset: string;
  showStoreName: boolean;
  showProductName: boolean;
  showPrice: boolean;
  showCodeText: boolean;
  storeName: string;
  customLayout: boolean;
  layoutXY: {
    store: { x: string; y: string };
    product: { x: string; y: string };
    barcode: { x: string; y: string };
    price: { x: string; y: string };
  };
  fontSize: {
    store: 1 | 2;
    product: 1 | 2;
    price: 1 | 2;
  };
  lastPrinterAddress?: string;
  lastPrinterName?: string;
}
