import { createClient } from '@supabase/supabase-js';
import { Branch, Product, Sale, SaleItem, SaleWithItems, UserProfile, InventoryTransaction, UserRole, BusinessProfile, CashFlowEntry, SaleDeleteRequest } from '../types';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured =
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  supabaseAnonKey !== 'your-anon-key' &&
  supabaseAnonKey !== 'your-publishable-key';

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

const DEFAULT_BRANCH_NAME = 'Main Store';
const DEFAULT_BRANCH_ID = 'branch-default';

const SKU_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const SKU_LENGTH = 14;
const BARCODE_LENGTH = 6;
const BARCODE_MAX = 10 ** BARCODE_LENGTH - 1;

const randomSku = () => {
  let out = '';
  for (let i = 0; i < SKU_LENGTH; i++) {
    out += SKU_ALPHABET[Math.floor(Math.random() * SKU_ALPHABET.length)];
  }
  return out;
};

const normalizeSku = (value?: string | null) => (value || '').trim().toUpperCase();
const normalizeBarcode = (value?: string | null) => (value || '').trim();

const collectProductCodes = async (excludeId?: string): Promise<{ skus: Set<string>; barcodes: Set<string> }> => {
  const skus = new Set<string>();
  const barcodes = new Set<string>();

  if (!supabase) return { skus, barcodes };

  try {
    const { data, error } = await supabase.from('products').select('id, sku, barcode');
    if (error) throw error;
    (data || []).forEach(row => {
      if (excludeId && row.id === excludeId) return;
      const sku = normalizeSku(row.sku);
      const barcode = normalizeBarcode(row.barcode);
      if (sku) skus.add(sku);
      if (barcode) barcodes.add(barcode);
    });
  } catch (err) {
    console.warn('Product code lookup failed:', err);
  }

  return { skus, barcodes };
};

const nextSequentialBarcode = (taken: Set<string>): string => {
  let highest = 0;
  taken.forEach(code => {
    if (!/^\d+$/.test(code) || code.length > BARCODE_LENGTH) return;
    const value = parseInt(code, 10);
    if (value > highest) highest = value;
  });

  let candidate = highest + 1;
  while (candidate <= BARCODE_MAX && taken.has(String(candidate).padStart(BARCODE_LENGTH, '0'))) {
    candidate++;
  }
  if (candidate > BARCODE_MAX) {
    throw new Error(`All ${BARCODE_LENGTH}-digit barcodes are in use. Widen the barcode format to add more products.`);
  }
  return String(candidate).padStart(BARCODE_LENGTH, '0');
};

const CURRENT_USER_KEY = 'retail_shop_current_user';
const MOCK_BUSINESS_KEY = 'retail_shop_business_profile';

export const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  name: 'RetailHub',
  tagline: 'Multi-branch Retail POS System',
  logo_url: '',
  phone: '+95 9 123 456 789',
  email: 'info@retailhub.com',
  address: 'Yangon, Myanmar',
  tax_rate: 5,
  receipt_footer: 'Thank you for shopping with us! Please come again.',
  currency: 'Ks'
};

export const formatEmailWithDefaultDomain = (input: string): string => {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed.includes('@')) return trimmed;
  return `${trimmed}@pos.com`;
};

export const dbService = {
  auth: {
    async login(email: string, arg2?: string | UserRole, arg3?: string): Promise<UserProfile> {
      let role: UserRole | undefined = undefined;
      let password: string | undefined = undefined;

      if (arg2 === 'owner' || arg2 === 'cashier') {
        role = arg2 as UserRole;
        password = arg3;
      } else {
        password = arg2;
        role = arg3 as UserRole | undefined;
      }

      const cleanEmail = formatEmailWithDefaultDomain(email);

      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      }

      if (!password) {
        throw new Error('Password is required.');
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password
      });

      if (authError) throw authError;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (error) throw error;

      let profile = data;
      if (!profile) {
        const determinedRole: UserRole = role || (cleanEmail.includes('manager') ? 'manager' : cleanEmail.includes('cashier') ? 'cashier' : 'owner');
        profile = {
          id: authData.user?.id || generateId(),
          email: cleanEmail,
          name: cleanEmail.split('@')[0],
          role: determinedRole,
          created_at: new Date().toISOString()
        };
        await supabase.from('profiles').insert(profile).select().maybeSingle();
      }

      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(profile));
      return profile as UserProfile;
    },

    async getCurrentUser(): Promise<UserProfile | null> {
      const userStr = localStorage.getItem(CURRENT_USER_KEY);

      if (!isSupabaseConfigured || !supabase) {
        return null;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          if (userStr) return JSON.parse(userStr);
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', session.user.email)
            .maybeSingle();
          if (profile) {
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(profile));
            return profile as UserProfile;
          }
          return null;
        }

        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshData.session) {
          if (userStr) return JSON.parse(userStr);
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', refreshData.session.user.email)
            .maybeSingle();
          if (profile) {
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(profile));
            return profile as UserProfile;
          }
          return null;
        }

        localStorage.removeItem(CURRENT_USER_KEY);
        return null;
      } catch {
        return userStr ? JSON.parse(userStr) : null;
      }
    },

    async changePassword(newPassword: string): Promise<void> {
      if (!supabase) throw new Error('Supabase not configured.');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },

    async logout(): Promise<void> {
      localStorage.removeItem(CURRENT_USER_KEY);
      if (supabase) {
        try {
          await supabase.auth.signOut();
        } catch (err) {
          console.warn('Supabase signOut failed:', err);
        }
      }
    },

    async getCashiers(): Promise<UserProfile[]> {
      if (!supabase) throw new Error('Supabase not configured.');
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['cashier', 'manager']);
      if (error) throw error;
      return data || [];
    },

    async addCashier(
      email: string,
      name: string,
      password?: string,
      branch_id?: string,
      branch_name?: string,
      role: UserRole = 'cashier'
    ): Promise<UserProfile> {
      if (!supabase) throw new Error('Supabase not configured.');
      const staffPassword = password && password.trim() ? password : null;
      if (!staffPassword) {
        throw new Error('Password is required for creating a cashier account.');
      }

      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      const { data: authData, error: authError } = await tempClient.auth.signUp({
        email: formatEmailWithDefaultDomain(email),
        password: staffPassword,
      });

      if (authError) throw authError;

      if (!authData.user?.id) {
        throw new Error('User creation returned no ID from Supabase Auth.');
      }

      const newCashier: UserProfile = {
        id: authData.user.id,
        email: formatEmailWithDefaultDomain(email),
        name,
        role,
        branch_id,
        branch_name,
        created_at: new Date().toISOString()
      };

      let profileRes = await tempClient
        .from('profiles')
        .upsert(newCashier)
        .select()
        .single();

      if (profileRes.error) {
        profileRes = await supabase
          .from('profiles')
          .upsert(newCashier)
          .select()
          .single();
      }

      if (profileRes.error) throw profileRes.error;

      return profileRes.data || newCashier;
    },

    async updateCashier(id: string, updates: Partial<UserProfile>): Promise<UserProfile> {
      if (!supabase) throw new Error('Supabase not configured.');
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async deleteCashier(id: string): Promise<void> {
      if (!supabase) throw new Error('Supabase not configured.');
      try {
        await supabase.from('sales').update({ cashier_id: null }).eq('cashier_id', id);
      } catch (e) {
        console.warn('Could not unlink sales cashier_id before delete:', e);
      }
      try {
        await supabase.from('sale_delete_requests').update({ cashier_id: null }).eq('cashier_id', id);
      } catch (e) {
        console.warn('Could not unlink sale_delete_requests cashier_id before delete:', e);
      }

      const { error } = await supabase.rpc('delete_user_account', { target_user_id: id });
      if (error) {
        const fallbackRes = await supabase.from('profiles').delete().eq('id', id);
        if (fallbackRes.error) throw fallbackRes.error;
      }
    }
  },

  branches: {
    async getAll(): Promise<Branch[]> {
      if (!supabase) throw new Error('Supabase not configured.');
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async create(branchData: Omit<Branch, 'id' | 'created_at'>): Promise<Branch> {
      if (!supabase) throw new Error('Supabase not configured.');
      const newBranch: Branch = {
        ...branchData,
        id: 'branch-' + generateId(),
        created_at: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('branches')
        .insert(newBranch)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async update(id: string, updates: Partial<Omit<Branch, 'id' | 'created_at'>>): Promise<Branch> {
      if (!supabase) throw new Error('Supabase not configured.');
      const { data, error } = await supabase
        .from('branches')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async delete(id: string): Promise<void> {
      if (!supabase) throw new Error('Supabase not configured.');
      await supabase.from('profiles').update({ branch_id: null, branch_name: null }).eq('branch_id', id);
      await supabase.from('products').update({ branch_id: null, branch_name: null }).eq('branch_id', id);
      await supabase.from('sales').update({ branch_id: null, branch_name: null }).eq('branch_id', id);
      await supabase.from('inventory_transactions').update({ branch_id: null, branch_name: null }).eq('branch_id', id);
      await supabase.from('cash_flow').update({ branch_id: null, branch_name: null }).eq('branch_id', id);
      const { error } = await supabase.from('branches').delete().eq('id', id);
      if (error) throw error;
    }
  },

  products: {
    async getAll(): Promise<Product[]> {
      if (!supabase) throw new Error('Supabase not configured.');
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async generateCodes(): Promise<{ sku: string; barcode: string }> {
      const { skus, barcodes } = await collectProductCodes();
      let sku = randomSku();
      let attempts = 0;
      while (skus.has(sku)) {
        if (++attempts > 50) throw new Error('Could not generate a unique SKU. Please enter one manually.');
        sku = randomSku();
      }
      return { sku, barcode: nextSequentialBarcode(barcodes) };
    },

    async create(prod: Omit<Product, 'id' | 'created_at'>, performedBy: string): Promise<Product> {
      if (!supabase) throw new Error('Supabase not configured.');
      const { skus, barcodes } = await collectProductCodes();
      const requestedSku = normalizeSku(prod.sku);
      const requestedBarcode = normalizeBarcode(prod.barcode);

      if (requestedSku && skus.has(requestedSku)) {
        throw new Error(`SKU "${requestedSku}" is already used by another product.`);
      }
      if (requestedBarcode && barcodes.has(requestedBarcode)) {
        throw new Error(`Barcode "${requestedBarcode}" is already used by another product.`);
      }

      const newProd: Product = {
        ...prod,
        sku: requestedSku || randomSku(),
        barcode: requestedBarcode || nextSequentialBarcode(barcodes),
        id: generateId(),
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('products')
        .insert(newProd)
        .select()
        .single();
      if (error) throw error;

      try {
        await supabase.from('inventory_transactions').insert({
          id: generateId(),
          product_id: data.id,
          product_name: data.name,
          branch_id: newProd.branch_id || DEFAULT_BRANCH_ID,
          branch_name: newProd.branch_name || DEFAULT_BRANCH_NAME,
          type: 'stock-in',
          quantity: data.stock,
          notes: 'Initial stock load on product creation',
          performed_by: performedBy,
          created_at: new Date().toISOString()
        });
      } catch (txErr) {
        console.warn('inventory_transactions insert failed (non-fatal):', txErr);
      }

      return data;
    },

    async update(id: string, updates: Partial<Omit<Product, 'id' | 'created_at'>>, performedBy: string): Promise<Product> {
      if (!supabase) throw new Error('Supabase not configured.');
      if (updates.sku !== undefined || updates.barcode !== undefined) {
        const { skus, barcodes } = await collectProductCodes(id);
        const nextSku = normalizeSku(updates.sku);
        const nextBarcode = normalizeBarcode(updates.barcode);
        if (nextSku && skus.has(nextSku)) {
          throw new Error(`SKU "${nextSku}" is already used by another product.`);
        }
        if (nextBarcode && barcodes.has(nextBarcode)) {
          throw new Error(`Barcode "${nextBarcode}" is already used by another product.`);
        }
      }

      const { data: current, error: fetchErr } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;

      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      if (updates.stock !== undefined && updates.stock !== current.stock) {
        const diff = updates.stock - current.stock;
        try {
          await supabase.from('inventory_transactions').insert({
            id: generateId(),
            product_id: id,
            product_name: data.name,
            branch_id: data.branch_id || DEFAULT_BRANCH_ID,
            branch_name: data.branch_name || DEFAULT_BRANCH_NAME,
            type: diff > 0 ? 'stock-in' : 'stock-out',
            quantity: Math.abs(diff),
            notes: `Stock adjusted manually. Old stock: ${current.stock}, New stock: ${updates.stock}`,
            performed_by: performedBy,
            created_at: new Date().toISOString()
          });
        } catch (txErr) {
          console.warn('inventory_transactions insert failed (non-fatal):', txErr);
        }
      }

      return data;
    },

    async restock(id: string, quantity: number, performedBy: string): Promise<Product> {
      if (!supabase) throw new Error('Supabase not configured.');
      if (!quantity || quantity <= 0) {
        throw new Error('Restock quantity must be a positive number.');
      }

      const { data: current, error: fetchErr } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;

      const oldStock = current.stock || 0;
      const newStock = oldStock + quantity;

      const { error } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', id);
      if (error) throw error;

      try {
        await supabase.from('inventory_transactions').insert({
          id: generateId(),
          product_id: id,
          product_name: current.name,
          branch_id: current.branch_id || DEFAULT_BRANCH_ID,
          branch_name: current.branch_name || DEFAULT_BRANCH_NAME,
          type: 'stock-in',
          quantity,
          notes: `Restocked +${quantity}. Old stock: ${oldStock}, New stock: ${newStock}`,
          performed_by: performedBy,
          created_at: new Date().toISOString()
        });
      } catch (txErr) {
        console.warn('inventory_transactions insert failed (non-fatal):', txErr);
      }

      return { ...current, stock: newStock };
    },

    async bulkImport(importedItems: Partial<Product>[], performedBy: string, branchId?: string, branchName?: string): Promise<number> {
      if (!supabase) throw new Error('Supabase not configured.');

      const targetBranchId = branchId || null;
      const targetBranchName = branchName || null;

      const usedBarcodes = new Set<string>();
      const usedSkus = new Set<string>();
      const usedIds = new Set<string>();

      const { data: remoteRows } = await supabase.from('products').select('id, sku, barcode');
      (remoteRows || []).forEach(p => {
        if (p.barcode) usedBarcodes.add(normalizeBarcode(p.barcode));
        if (p.sku) usedSkus.add(normalizeSku(p.sku));
        if (p.id) usedIds.add(p.id);
      });

      const upsertItems: Product[] = [];

      importedItems.forEach(item => {
        let idKey = generateId();
        while (usedIds.has(idKey)) {
          idKey = generateId();
        }

        const barcode = nextSequentialBarcode(usedBarcodes);

        let sku = normalizeSku(idKey);
        while (usedSkus.has(sku)) {
          sku = normalizeSku(generateId());
        }

        usedIds.add(idKey);
        usedBarcodes.add(normalizeBarcode(barcode));
        usedSkus.add(sku);

        const fullItem: Product = {
          id: idKey,
          sku,
          name: item.name || 'Unnamed Product',
          barcode,
          price: typeof item.price === 'number' ? item.price : 0,
          cost: typeof item.cost === 'number' ? item.cost : 0,
          stock: typeof item.stock === 'number' ? item.stock : 0,
          min_stock_level: item.min_stock_level || 5,
          category: item.category || 'General',
          image: item.image || null,
          description: item.description || '',
          use_stock: item.use_stock !== undefined ? item.use_stock : true,
          unit_amount: item.unit_amount || 1,
          unit_name: item.unit_name || 'ခု',
          price_variant: item.price_variant || '',
          expiry_date: item.expiry_date || '',
          updated_at: item.updated_at || new Date().toLocaleString(),
          created_at: item.created_at || new Date().toISOString(),
          branch_id: targetBranchId,
          branch_name: targetBranchName,
        };

        upsertItems.push(fullItem);
      });

      const { error } = await supabase.from('products').upsert(upsertItems);
      if (error) throw new Error(error.message || 'Failed to import products to database.');

      return importedItems.length;
    },

    async delete(id: string): Promise<void> {
      if (!supabase) throw new Error('Supabase not configured.');
      await supabase.from('inventory_transactions').update({ product_id: null }).eq('product_id', id);
      await supabase.from('sale_items').update({ product_id: null }).eq('product_id', id);
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    }
  },

  sales: {
    async getAllWithItems(): Promise<SaleWithItems[]> {
      if (!supabase) throw new Error('Supabase not configured.');
      const { data: sales, error: salesErr } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });
      if (salesErr) throw salesErr;

      const { data: items, error: itemsErr } = await supabase
        .from('sale_items')
        .select('*');
      if (itemsErr) throw itemsErr;

      return (sales || []).map(sale => ({
        ...sale,
        items: (items || []).filter(item => item.sale_id === sale.id)
      }));
    },

    async checkout(
      cart: { product: Product; quantity: number }[],
      paymentMethod: Sale['payment_method'],
      discount: number,
      cashier: UserProfile,
      customer?: { name?: string; phone?: string }
    ): Promise<SaleWithItems> {
      if (!supabase) throw new Error('Supabase not configured.');
      if (cart.length === 0) throw new Error('Cannot checkout an empty shopping cart');

      const saleId = 'sale-' + generateId();
      const now = new Date().toISOString();

      const rawTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      const totalAmount = Number(Math.max(0, rawTotal - discount).toFixed(2));

      const newSale: Sale = {
        id: saleId,
        cashier_id: cashier.id,
        cashier_name: cashier.name,
        branch_id: cashier.branch_id || DEFAULT_BRANCH_ID,
        branch_name: cashier.branch_name || DEFAULT_BRANCH_NAME,
        total_amount: totalAmount,
        discount: discount,
        payment_method: paymentMethod,
        customer_name: customer?.name || undefined,
        customer_phone: customer?.phone || undefined,
        created_at: now
      };

      const saleItems: SaleItem[] = cart.map((item, idx) => ({
        id: `sitem-${generateId()}-${idx}`,
        sale_id: saleId,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.price,
        unit_cost: item.product.cost,
        total: Number((item.product.price * item.quantity).toFixed(2))
      }));

      const { error: saleErr } = await supabase.from('sales').insert(newSale);
      if (saleErr) throw saleErr;

      const { error: itemsErr } = await supabase.from('sale_items').insert(saleItems);
      if (itemsErr) throw itemsErr;

      for (const item of cart) {
        const newStock = Math.max(0, item.product.stock - item.quantity);
        const { error: stockErr } = await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', item.product.id);
        if (stockErr) throw stockErr;

        const { error: txErr } = await supabase.from('inventory_transactions').insert({
          id: generateId(),
          product_id: item.product.id,
          product_name: item.product.name,
          branch_id: cashier.branch_id || DEFAULT_BRANCH_ID,
          branch_name: cashier.branch_name || DEFAULT_BRANCH_NAME,
          type: 'sale',
          quantity: item.quantity,
          notes: `Sold at POS to ${customer?.name || 'Walk-in Customer'}`,
          performed_by: cashier.name,
          created_at: now
        });
        if (txErr) throw txErr;
      }

      return { ...newSale, items: saleItems };
    }
  },

  cashFlow: {
    async getAll(): Promise<CashFlowEntry[]> {
      if (!supabase) throw new Error('Supabase not configured.');
      const { data, error } = await supabase
        .from('cash_flow')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async create(entry: Omit<CashFlowEntry, 'id' | 'created_at'>, performedBy: string): Promise<CashFlowEntry> {
      if (!supabase) throw new Error('Supabase not configured.');
      const newEntry: CashFlowEntry = {
        ...entry,
        amount: Number(Number(entry.amount).toFixed(2)),
        performed_by: performedBy,
        id: 'cf-' + generateId(),
        created_at: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('cash_flow')
        .insert(newEntry)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async update(id: string, updates: Partial<Omit<CashFlowEntry, 'id' | 'created_at'>>): Promise<CashFlowEntry> {
      if (!supabase) throw new Error('Supabase not configured.');
      const { data, error } = await supabase
        .from('cash_flow')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async delete(id: string): Promise<void> {
      if (!supabase) throw new Error('Supabase not configured.');
      const { error } = await supabase.from('cash_flow').delete().eq('id', id);
      if (error) throw error;
    }
  },

  transactions: {
    async getAll(): Promise<InventoryTransaction[]> {
      if (!supabase) throw new Error('Supabase not configured.');
      const { data, error } = await supabase
        .from('inventory_transactions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  },

  business: {
    async get(): Promise<BusinessProfile> {
      if (supabase) {
        try {
          const { data } = await supabase
            .from('business_settings')
            .select('*')
            .limit(1)
            .maybeSingle();
          if (data) return { ...DEFAULT_BUSINESS_PROFILE, ...data };
        } catch (err) {
          console.warn('business.get failed, using local cache:', err);
        }
      }
      const stored = localStorage.getItem(MOCK_BUSINESS_KEY);
      if (stored) {
        try {
          return { ...DEFAULT_BUSINESS_PROFILE, ...JSON.parse(stored) };
        } catch {
          return DEFAULT_BUSINESS_PROFILE;
        }
      }
      return DEFAULT_BUSINESS_PROFILE;
    },

    async update(data: Partial<BusinessProfile>): Promise<BusinessProfile> {
      const current = await this.get();
      const updated: BusinessProfile = {
        ...current,
        ...data,
        updated_at: new Date().toISOString()
      };

      localStorage.setItem(MOCK_BUSINESS_KEY, JSON.stringify(updated));

      if (supabase) {
        try {
          await supabase.from('business_settings').upsert({ id: 'main', ...updated });
        } catch (err) {
          console.warn('business.update Supabase write failed (local cache saved):', err);
        }
      }

      return updated;
    }
  },

  saleDeleteRequests: {
    async getAll(): Promise<SaleDeleteRequest[]> {
      if (!supabase) throw new Error('Supabase not configured.');
      const { data, error } = await supabase
        .from('sale_delete_requests')
        .select('*')
        .order('requested_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async create(requestData: Omit<SaleDeleteRequest, 'id' | 'requested_at' | 'status'>): Promise<SaleDeleteRequest> {
      if (!supabase) throw new Error('Supabase not configured.');
      const newReq: SaleDeleteRequest = {
        ...requestData,
        id: 'delreq-' + generateId(),
        status: 'pending',
        requested_at: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('sale_delete_requests')
        .insert(newReq)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async approve(requestId: string, reviewedBy: string): Promise<void> {
      if (!supabase) throw new Error('Supabase not configured.');
      const now = new Date().toISOString();

      const { data: req, error: reqErr } = await supabase
        .from('sale_delete_requests')
        .select('*')
        .eq('id', requestId)
        .single();
      if (reqErr) throw reqErr;
      if (!req) throw new Error('Delete request not found');

      const allSales = await dbService.sales.getAllWithItems();
      const targetSale = allSales.find(s => s.id === req.sale_id);
      if (targetSale && targetSale.items && targetSale.items.length > 0) {
        const products = await dbService.products.getAll();
        for (const item of targetSale.items) {
          const prod = products.find(p => p.id === item.product_id);
          if (prod) {
            await dbService.products.restock(prod.id, item.quantity, reviewedBy);
          }
        }
      }

      await supabase
        .from('sale_delete_requests')
        .update({ status: 'approved', reviewed_at: now, reviewed_by: reviewedBy })
        .eq('id', requestId);

      if (req.sale_id) {
        await supabase.from('sales').delete().eq('id', req.sale_id);
      }
    },

    async reject(requestId: string, reviewedBy: string, rejectionReason?: string): Promise<void> {
      if (!supabase) throw new Error('Supabase not configured.');
      const now = new Date().toISOString();
      await supabase
        .from('sale_delete_requests')
        .update({ status: 'rejected', reviewed_at: now, reviewed_by: reviewedBy, rejection_reason: rejectionReason || '' })
        .eq('id', requestId);
    }
  },

  sync: {
    async syncOfflineData(): Promise<{ syncedCount: number; success: boolean; message: string }> {
      return { syncedCount: 0, success: true, message: 'App is running in online-only mode.' };
    }
  }
};