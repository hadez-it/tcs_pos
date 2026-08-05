import { createClient } from '@supabase/supabase-js';
import { Branch, Product, Sale, SaleItem, SaleWithItems, UserProfile, InventoryTransaction, UserRole, BusinessProfile, CashFlowEntry } from '../types';

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

// ==========================================
// PRODUCT CODE GENERATION (SKU / BARCODE)
// ==========================================
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

/**
 * Every SKU / barcode already in use, unioned across Supabase and LocalStorage.
 * Both stores matter: the app writes to LocalStorage whenever Supabase is
 * unreachable, so a code can exist in either one.
 */
const collectProductCodes = async (excludeId?: string): Promise<{ skus: Set<string>; barcodes: Set<string> }> => {
  const skus = new Set<string>();
  const barcodes = new Set<string>();

  const absorb = (rows: Array<{ id?: string | null; sku?: string | null; barcode?: string | null }>) => {
    rows.forEach(row => {
      if (excludeId && row.id === excludeId) return;
      const sku = normalizeSku(row.sku);
      const barcode = normalizeBarcode(row.barcode);
      if (sku) skus.add(sku);
      if (barcode) barcodes.add(barcode);
    });
  };

  absorb(getMockData<Product>(MOCK_PRODUCTS_KEY));

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('products').select('id, sku, barcode');
      if (error) throw error;
      absorb(data || []);
    } catch (err) {
      console.warn('Supabase product code lookup failed, using LocalStorage codes only:', err);
    }
  }

  return { skus, barcodes };
};

/**
 * Next sequential 6-digit barcode. Only codes that already fit in 6 digits seed
 * the sequence, so a scanned EAN-13 on some product cannot push the counter
 * past its width.
 */
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

// ==========================================
// MOCK DATABASE & SEED DATA (LOCAL STORAGE)
// ==========================================

const MOCK_PROFILES_KEY = 'retail_shop_profiles';
const MOCK_PRODUCTS_KEY = 'retail_shop_products';
const MOCK_SALES_KEY = 'retail_shop_sales';
const MOCK_SALE_ITEMS_KEY = 'retail_shop_sale_items';
const MOCK_TRANSACTIONS_KEY = 'retail_shop_transactions';
const MOCK_CASHFLOW_KEY = 'retail_shop_cash_flow';
const MOCK_BRANCHES_KEY = 'retail_shop_branches';
const MOCK_BUSINESS_KEY = 'retail_shop_business_profile';
const CURRENT_USER_KEY = 'retail_shop_current_user';

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

const INITIAL_BRANCHES: Branch[] = [];

const INITIAL_PROFILES: UserProfile[] = [];

const INITIAL_PRODUCTS: Product[] = [];

// Helper to seed localStorage (starts completely clean)
const seedLocalStorage = () => {
  // Clear any existing demo data from earlier sessions
  if (!localStorage.getItem('has_cleared_demo_data_v3')) {
    localStorage.removeItem(MOCK_BRANCHES_KEY);
    localStorage.removeItem(MOCK_PRODUCTS_KEY);
    localStorage.removeItem(MOCK_PROFILES_KEY);
    localStorage.removeItem(MOCK_SALES_KEY);
    localStorage.removeItem(MOCK_SALE_ITEMS_KEY);
    localStorage.removeItem(MOCK_TRANSACTIONS_KEY);
    localStorage.removeItem(MOCK_CASHFLOW_KEY);
    localStorage.setItem('has_cleared_demo_data_v3', 'true');
  }

  if (!localStorage.getItem(MOCK_BRANCHES_KEY)) {
    localStorage.setItem(MOCK_BRANCHES_KEY, JSON.stringify([]));
  }
  if (!localStorage.getItem(MOCK_PROFILES_KEY)) {
    localStorage.setItem(MOCK_PROFILES_KEY, JSON.stringify([]));
  }
  if (!localStorage.getItem(MOCK_PRODUCTS_KEY)) {
    localStorage.setItem(MOCK_PRODUCTS_KEY, JSON.stringify([]));
  }
  if (!localStorage.getItem(MOCK_SALES_KEY)) {
    localStorage.setItem(MOCK_SALES_KEY, JSON.stringify([]));
  }
  if (!localStorage.getItem(MOCK_SALE_ITEMS_KEY)) {
    localStorage.setItem(MOCK_SALE_ITEMS_KEY, JSON.stringify([]));
  }
  if (!localStorage.getItem(MOCK_TRANSACTIONS_KEY)) {
    localStorage.setItem(MOCK_TRANSACTIONS_KEY, JSON.stringify([]));
  }
  if (!localStorage.getItem(MOCK_CASHFLOW_KEY)) {
    localStorage.setItem(MOCK_CASHFLOW_KEY, JSON.stringify([]));
  }
};

// Seed storage now
if (typeof window !== 'undefined') {
  seedLocalStorage();
}

// Get helper keys
const getMockData = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  if (!data && key === MOCK_BRANCHES_KEY) {
    return INITIAL_BRANCHES as unknown as T[];
  }
  return data ? JSON.parse(data) : [];
};

const saveMockData = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// ==========================================
// DATABASE APIs (TRANSPARENT ROUTING)
// ==========================================

export const formatEmailWithDefaultDomain = (input: string): string => {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed.includes('@')) return trimmed;
  return `${trimmed}@pos.com`;
};

export const dbService = {
  // ----------------------------------------
  // AUTHENTICATION
  // ----------------------------------------
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

      if (isSupabaseConfigured && supabase) {
        try {
          if (!password) {
            throw new Error('Password is required for Supabase authentication.');
          }

          // Authenticate with Supabase Auth
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: password
          });

          if (authError) throw authError;

          // Fetch user profile to get the actual role registered in Supabase
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle();

          if (error) throw error;
          
          let profile = data;
          if (!profile) {
            // If the user created an account in Supabase Auth but there's no profile record yet,
            // create a profile with inferred or provided role
            const determinedRole: UserRole = role || (cleanEmail.includes('cashier') ? 'cashier' : 'owner');
            profile = {
              id: authData.user?.id || generateId(),
              email: cleanEmail,
              name: cleanEmail.split('@')[0],
              role: determinedRole,
              created_at: new Date().toISOString()
            };
            
            await supabase.from('profiles').insert(profile).select().maybeSingle();
          }

          // Keep session in localStorage
          localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(profile));
          return profile as UserProfile;
        } catch (err: any) {
          console.warn('Supabase login failed:', err);
          if (err.message && (err.message.includes('Invalid login') || err.message.includes('Password') || err.message.includes('credentials'))) {
             throw err;
          }
          
          const profiles = getMockData<UserProfile>(MOCK_PROFILES_KEY);
          const user = profiles.find(p => p.email.toLowerCase() === cleanEmail);
          
          if (!user) {
            throw new Error(err.message || 'Account credentials not found.');
          }

          localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
          return user;
        }
      } else {
        // Mock Mode login
        const profiles = getMockData<UserProfile>(MOCK_PROFILES_KEY);
        let user = profiles.find(p => p.email.toLowerCase() === cleanEmail);
        
        if (!user) {
          // Dynamically create user profile in mock storage with inferred or default role
          const determinedRole: UserRole = role || (cleanEmail.includes('cashier') ? 'cashier' : 'owner');
          user = {
            id: generateId(),
            email: cleanEmail,
            name: cleanEmail.split('@')[0],
            role: determinedRole,
            created_at: new Date().toISOString()
          };
          profiles.push(user);
          saveMockData(MOCK_PROFILES_KEY, profiles);
        }

        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        return user;
      }
    },

    async getCurrentUser(): Promise<UserProfile | null> {
      const userStr = localStorage.getItem(CURRENT_USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    },

    async logout(): Promise<void> {
      localStorage.removeItem(CURRENT_USER_KEY);
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.auth.signOut();
        } catch (err) {
          console.warn('Supabase signOut failed:', err);
        }
      }
    },

    // Get all cashiers (Owner can manage cashiers)
    async getCashiers(): Promise<UserProfile[]> {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'cashier');
          if (error) throw error;
          return data || [];
        } catch (err) {
          console.warn('Supabase getCashiers failed, falling back to LocalStorage:', err);
          const profiles = getMockData<UserProfile>(MOCK_PROFILES_KEY);
          return profiles.filter(p => p.role === 'cashier');
        }
      } else {
        const profiles = getMockData<UserProfile>(MOCK_PROFILES_KEY);
        return profiles.filter(p => p.role === 'cashier');
      }
    },

    async addCashier(
      email: string, 
      name: string, 
      password?: string, 
      branch_id?: string, 
      branch_name?: string
    ): Promise<UserProfile> {
      const staffPassword = password && password.trim() ? password : null;
      if (isSupabaseConfigured && supabase) {
        try {
          if (!staffPassword) {
            throw new Error('Password is required for creating a cashier account.');
          }
          // Use a temporary client to sign up the new user without logging out the current user
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
            role: 'cashier',
            branch_id,
            branch_name,
            created_at: new Date().toISOString()
          };

          // Try to insert profile using tempClient first, then fallback to main client
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

          if (profileRes.error) {
            throw profileRes.error;
          }

          return profileRes.data || newCashier;
        } catch (err: any) {
          console.error('Supabase addCashier error:', err);
          const rawMsg = typeof err === 'string' ? err : (err?.message || err?.error_description || err?.msg || '');
          let errorMsg = rawMsg && rawMsg !== '{}' 
            ? rawMsg 
            : 'Failed to add cashier to Supabase. Make sure the user does not already exist and your SQL schema is applied.';

          if (rawMsg.toLowerCase().includes('rate limit') || rawMsg.toLowerCase().includes('rate_limit')) {
            errorMsg = 'Supabase Email Rate Limit Exceeded: Supabase limits how many account confirmation emails can be sent per hour (default 3/hr on default SMTP). Please wait a few minutes before adding another cashier, or disable "Confirm email" in your Supabase Dashboard (Authentication -> Providers -> Email -> Confirm email: OFF).';
          }

          throw new Error(errorMsg);
        }
      } else {
        const newCashier: UserProfile = {
          id: generateId(),
          email: formatEmailWithDefaultDomain(email),
          name,
          role: 'cashier',
          branch_id,
          branch_name,
          created_at: new Date().toISOString()
        };
        const profiles = getMockData<UserProfile>(MOCK_PROFILES_KEY);
        if (profiles.some(p => p.email === newCashier.email)) {
          throw new Error('A user with this email already exists.');
        }
        profiles.push(newCashier);
        saveMockData(MOCK_PROFILES_KEY, profiles);
        return newCashier;
      }
    },

    async updateCashier(id: string, updates: Partial<UserProfile>): Promise<UserProfile> {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
          if (error) throw error;
          return data;
        } catch (err) {
          console.warn('Supabase updateCashier failed, falling back to LocalStorage:', err);
          const profiles = getMockData<UserProfile>(MOCK_PROFILES_KEY);
          const idx = profiles.findIndex(p => p.id === id);
          if (idx !== -1) {
            profiles[idx] = { ...profiles[idx], ...updates };
            saveMockData(MOCK_PROFILES_KEY, profiles);
            return profiles[idx];
          }
          throw new Error('Cashier not found');
        }
      } else {
        const profiles = getMockData<UserProfile>(MOCK_PROFILES_KEY);
        const idx = profiles.findIndex(p => p.id === id);
        if (idx !== -1) {
          profiles[idx] = { ...profiles[idx], ...updates };
          saveMockData(MOCK_PROFILES_KEY, profiles);
          return profiles[idx];
        }
        throw new Error('Cashier not found');
      }
    },

    async deleteCashier(id: string): Promise<void> {
      // Always keep LocalStorage mock data updated
      const profiles = getMockData<UserProfile>(MOCK_PROFILES_KEY);
      const updated = profiles.filter(p => p.id !== id);
      saveMockData(MOCK_PROFILES_KEY, updated);

      if (isSupabaseConfigured && supabase) {
        try {
          // Unlink cashier from any sales first to avoid foreign key constraint errors
          await supabase.from('sales').update({ cashier_id: null }).eq('cashier_id', id);

          const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', id);

          if (error) {
            console.error('Supabase deleteCashier error:', error);
            throw error;
          }
        } catch (err: any) {
          console.error('Supabase deleteCashier failed:', err);
          throw new Error(err.message || 'Failed to delete cashier from Supabase');
        }
      }
    }
  },

  // ----------------------------------------
  // BRANCH MANAGEMENT
  // ----------------------------------------
  branches: {
    async getAll(): Promise<Branch[]> {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('branches')
            .select('*')
            .order('name', { ascending: true });
          if (error) throw error;
          if (!data || data.length === 0) {
            return getMockData<Branch>(MOCK_BRANCHES_KEY);
          }
          return data;
        } catch (err) {
          console.warn('Supabase branches.getAll failed, falling back to LocalStorage:', err);
          return getMockData<Branch>(MOCK_BRANCHES_KEY);
        }
      } else {
        return getMockData<Branch>(MOCK_BRANCHES_KEY);
      }
    },

    async create(branchData: Omit<Branch, 'id' | 'created_at'>): Promise<Branch> {
      const newBranch: Branch = {
        ...branchData,
        id: 'branch-' + generateId(),
        created_at: new Date().toISOString()
      };

      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('branches')
            .insert(newBranch)
            .select()
            .single();
          if (error) throw error;
          return data;
        } catch (err) {
          console.warn('Supabase branches.create failed, falling back to LocalStorage:', err);
          const branches = getMockData<Branch>(MOCK_BRANCHES_KEY);
          branches.push(newBranch);
          saveMockData(MOCK_BRANCHES_KEY, branches);
          return newBranch;
        }
      } else {
        const branches = getMockData<Branch>(MOCK_BRANCHES_KEY);
        branches.push(newBranch);
        saveMockData(MOCK_BRANCHES_KEY, branches);
        return newBranch;
      }
    },

    async update(id: string, updates: Partial<Omit<Branch, 'id' | 'created_at'>>): Promise<Branch> {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('branches')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
          if (error) throw error;
          return data;
        } catch (err) {
          console.warn('Supabase branches.update failed, falling back to LocalStorage:', err);
          const branches = getMockData<Branch>(MOCK_BRANCHES_KEY);
          const idx = branches.findIndex(b => b.id === id);
          if (idx !== -1) {
            branches[idx] = { ...branches[idx], ...updates };
            saveMockData(MOCK_BRANCHES_KEY, branches);
            return branches[idx];
          }
          throw new Error('Branch not found');
        }
      } else {
        const branches = getMockData<Branch>(MOCK_BRANCHES_KEY);
        const idx = branches.findIndex(b => b.id === id);
        if (idx !== -1) {
          branches[idx] = { ...branches[idx], ...updates };
          saveMockData(MOCK_BRANCHES_KEY, branches);
          return branches[idx];
        }
        throw new Error('Branch not found');
      }
    },

    async delete(id: string): Promise<void> {
      // Clean up LocalStorage mock data first
      const branches = getMockData<Branch>(MOCK_BRANCHES_KEY);
      const updatedBranches = branches.filter(b => b.id !== id);
      saveMockData(MOCK_BRANCHES_KEY, updatedBranches);

      const profiles = getMockData<UserProfile>(MOCK_PROFILES_KEY);
      saveMockData(MOCK_PROFILES_KEY, profiles.map(p => p.branch_id === id ? { ...p, branch_id: undefined, branch_name: undefined } : p));

      const products = getMockData<Product>(MOCK_PRODUCTS_KEY);
      saveMockData(MOCK_PRODUCTS_KEY, products.map(p => p.branch_id === id ? { ...p, branch_id: undefined, branch_name: undefined } : p));

      if (isSupabaseConfigured && supabase) {
        try {
          // Unlink branch references in Supabase tables before deleting
          await supabase.from('profiles').update({ branch_id: null, branch_name: null }).eq('branch_id', id);
          await supabase.from('products').update({ branch_id: null, branch_name: null }).eq('branch_id', id);
          await supabase.from('sales').update({ branch_id: null, branch_name: null }).eq('branch_id', id);
          await supabase.from('inventory_transactions').update({ branch_id: null, branch_name: null }).eq('branch_id', id);
          await supabase.from('cash_flow').update({ branch_id: null, branch_name: null }).eq('branch_id', id);

          const { error } = await supabase.from('branches').delete().eq('id', id);
          if (error) {
            console.error('Supabase branches.delete error:', error);
            throw error;
          }
        } catch (err: any) {
          console.error('Supabase branches.delete failed:', err);
          throw new Error(err.message || 'Failed to delete branch from Supabase');
        }
      }
    }
  },

  // ----------------------------------------
  // PRODUCTS & INVENTORY
  // ----------------------------------------
  products: {
    async getAll(): Promise<Product[]> {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('name', { ascending: true });
          if (error) throw error;
          return data || [];
        } catch (err) {
          console.warn('Supabase products.getAll failed, falling back to LocalStorage:', err);
          const products = getMockData<Product>(MOCK_PRODUCTS_KEY);
          return products.sort((a, b) => a.name.localeCompare(b.name));
        }
      } else {
        const products = getMockData<Product>(MOCK_PRODUCTS_KEY);
        return products.sort((a, b) => a.name.localeCompare(b.name));
      }
    },

    /**
     * Mints a fresh SKU + barcode pair that collides with nothing currently
     * stored. Used to prefill the new-product form; `create` re-checks at write
     * time in case another device claimed the code in between.
     */
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
      // Re-validate the codes against live data — the form may have been open a
      // while, or another device may have taken the same barcode meanwhile.
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

      if (isSupabaseConfigured && supabase) {
        try {
          // Insert product
          const { data, error } = await supabase
            .from('products')
            .insert(newProd)
            .select()
            .single();
          if (error) throw error;

          // Log transaction — non-fatal, don't let a logging failure lose the product
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
        } catch (err) {
          console.warn('Supabase products.create failed, falling back to LocalStorage:', err);
          const products = getMockData<Product>(MOCK_PRODUCTS_KEY);
          if (products.some(p => normalizeSku(p.sku) === newProd.sku)) {
            throw new Error(`Product with SKU "${newProd.sku}" already exists.`);
          }
          products.push(newProd);
          saveMockData(MOCK_PRODUCTS_KEY, products);

          // Record log
          const transactions = getMockData<InventoryTransaction>(MOCK_TRANSACTIONS_KEY);
          transactions.push({
            id: generateId(),
            product_id: newProd.id,
            product_name: newProd.name,
            branch_id: newProd.branch_id || DEFAULT_BRANCH_ID,
            branch_name: newProd.branch_name || DEFAULT_BRANCH_NAME,
            type: 'stock-in',
            quantity: newProd.stock,
            notes: 'Initial stock load on product creation',
            performed_by: performedBy,
            created_at: new Date().toISOString()
          });
          saveMockData(MOCK_TRANSACTIONS_KEY, transactions);

          return newProd;
        }
      } else {
        const products = getMockData<Product>(MOCK_PRODUCTS_KEY);
        if (products.some(p => normalizeSku(p.sku) === newProd.sku)) {
          throw new Error(`Product with SKU "${newProd.sku}" already exists.`);
        }
        products.push(newProd);
        saveMockData(MOCK_PRODUCTS_KEY, products);

        // Record log
        const transactions = getMockData<InventoryTransaction>(MOCK_TRANSACTIONS_KEY);
        transactions.push({
          id: generateId(),
          product_id: newProd.id,
          product_name: newProd.name,
          type: 'stock-in',
          quantity: newProd.stock,
          notes: 'Initial stock load on product creation',
          performed_by: performedBy,
          created_at: new Date().toISOString()
        });
        saveMockData(MOCK_TRANSACTIONS_KEY, transactions);

        return newProd;
      }
    },

    async update(id: string, updates: Partial<Omit<Product, 'id' | 'created_at'>>, performedBy: string): Promise<Product> {
      // Reject a SKU/barcode edit that would collide with a *different* product.
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

      if (isSupabaseConfigured && supabase) {
        try {
          // Fetch existing first to check if stock changed
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

          // Record stock adjustments if stock was updated — non-fatal
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
        } catch (err) {
          console.warn('Supabase products.update failed, falling back to LocalStorage:', err);
          const products = getMockData<Product>(MOCK_PRODUCTS_KEY);
          const idx = products.findIndex(p => p.id === id);
          if (idx === -1) throw new Error('Product not found');

          const current = products[idx];
          const updatedProduct = { ...current, ...updates };
          products[idx] = updatedProduct;
          saveMockData(MOCK_PRODUCTS_KEY, products);

          // Log transaction if stock changed
          if (updates.stock !== undefined && updates.stock !== current.stock) {
            const diff = updates.stock - current.stock;
            const transactions = getMockData<InventoryTransaction>(MOCK_TRANSACTIONS_KEY);
            transactions.push({
              id: generateId(),
              product_id: id,
              product_name: updatedProduct.name,
              type: diff > 0 ? 'stock-in' : 'stock-out',
              quantity: Math.abs(diff),
              notes: `Stock adjusted manually. Old stock: ${current.stock}, New stock: ${updates.stock}`,
              performed_by: performedBy,
              created_at: new Date().toISOString()
            });
            saveMockData(MOCK_TRANSACTIONS_KEY, transactions);
          }

          return updatedProduct;
        }
      } else {
        const products = getMockData<Product>(MOCK_PRODUCTS_KEY);
        const idx = products.findIndex(p => p.id === id);
        if (idx === -1) throw new Error('Product not found');

        const current = products[idx];
        const updatedProduct = { ...current, ...updates };
        products[idx] = updatedProduct;
        saveMockData(MOCK_PRODUCTS_KEY, products);

        // Log transaction if stock changed
        if (updates.stock !== undefined && updates.stock !== current.stock) {
          const diff = updates.stock - current.stock;
          const transactions = getMockData<InventoryTransaction>(MOCK_TRANSACTIONS_KEY);
          transactions.push({
            id: generateId(),
            product_id: id,
            product_name: updatedProduct.name,
            branch_id: updatedProduct.branch_id || DEFAULT_BRANCH_ID,
            branch_name: updatedProduct.branch_name || DEFAULT_BRANCH_NAME,
            type: diff > 0 ? 'stock-in' : 'stock-out',
            quantity: Math.abs(diff),
            notes: `Stock adjusted manually. Old stock: ${current.stock}, New stock: ${updates.stock}`,
            performed_by: performedBy,
            created_at: new Date().toISOString()
          });
          saveMockData(MOCK_TRANSACTIONS_KEY, transactions);
        }

        return updatedProduct;
      }
    },

    async bulkImport(importedItems: Partial<Product>[], performedBy: string, branchId?: string, branchName?: string): Promise<number> {
      const existingProducts = getMockData<Product>(MOCK_PRODUCTS_KEY);
      const updatedList: Product[] = [...existingProducts];

      const targetBranchId = branchId || null;
      const targetBranchName = branchName || null;

      // Seed taken codes from BOTH localStorage and Supabase so the dedupe
      // below can never mint a code that already lives in the database.
      const usedBarcodes = new Set<string>();
      const usedSkus = new Set<string>();
      const usedIds = new Set<string>();

      existingProducts.forEach(p => {
        if (p.barcode) usedBarcodes.add(normalizeBarcode(p.barcode));
        if (p.sku) usedSkus.add(normalizeSku(p.sku));
        if (p.id) usedIds.add(p.id);
      });

      if (isSupabaseConfigured && supabase) {
        try {
          const { data: remoteRows } = await supabase
            .from('products')
            .select('id, sku, barcode');
          (remoteRows || []).forEach(p => {
            if (p.barcode) usedBarcodes.add(normalizeBarcode(p.barcode));
            if (p.sku) usedSkus.add(normalizeSku(p.sku));
            if (p.id) usedIds.add(p.id);
          });
        } catch (err) {
          console.warn('Could not fetch remote product codes for import dedupe:', err);
        }
      }

      const upsertItems: Product[] = [];

      importedItems.forEach(item => {
        let idKey = item.id || item.sku || generateId();
        const existingIdx = updatedList.findIndex(p => p.id === idKey || (p.sku && p.sku.toUpperCase() === idKey.toUpperCase()));

        // Duplicate id within this same import batch (or a collision with an
        // existing product) must not produce a second upsert row with the same
        // primary key — that makes ON CONFLICT DO UPDATE hit the row twice.
        if (usedIds.has(idKey)) {
          idKey = generateId();
        }
        const existingProduct = existingIdx !== -1 ? updatedList[existingIdx] : undefined;

        // If we're updating a product that already exists, keep its codes so a
        // re-import of the same file never churns barcodes / SKUs.
        let barcode = existingProduct?.barcode || item.barcode || idKey;
        let sku = (existingProduct?.sku || item.sku || idKey).toUpperCase();

        if (existingProduct) {
          // Release this product's own codes so they don't count as taken for itself.
          usedBarcodes.delete(normalizeBarcode(existingProduct.barcode));
          usedSkus.delete(normalizeSku(existingProduct.sku));
        }

        // Resolve collisions with other products or earlier rows in this import.
        if (barcode && usedBarcodes.has(normalizeBarcode(barcode))) {
          barcode = nextSequentialBarcode(usedBarcodes);
        }
        usedBarcodes.add(normalizeBarcode(barcode));

        if (sku && usedSkus.has(normalizeSku(sku))) {
          let suffix = 1;
          let candidate = `${sku}-${suffix}`;
          while (usedSkus.has(normalizeSku(candidate))) {
            candidate = `${sku}-${++suffix}`;
          }
          sku = candidate;
        }
        usedSkus.add(normalizeSku(sku));

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

        if (existingIdx !== -1) {
          updatedList[existingIdx] = { ...updatedList[existingIdx], ...fullItem };
        } else {
          updatedList.push(fullItem);
        }
        usedIds.add(idKey);
        upsertItems.push(fullItem);
      });

      saveMockData(MOCK_PRODUCTS_KEY, updatedList);

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('products').upsert(upsertItems);
        if (error) {
          console.error('Supabase bulkImport upsert error:', error);
          throw new Error(error.message || 'Failed to import products to database.');
        }
      }

      return importedItems.length;
    },

    async delete(id: string): Promise<void> {
      // Always update LocalStorage
      const products = getMockData<Product>(MOCK_PRODUCTS_KEY);
      const updated = products.filter(p => p.id !== id);
      saveMockData(MOCK_PRODUCTS_KEY, updated);

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('inventory_transactions').update({ product_id: null }).eq('product_id', id);
          await supabase.from('sale_items').update({ product_id: null }).eq('product_id', id);

          const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

          if (error) {
            console.error('Supabase products.delete error:', error);
            throw error;
          }
        } catch (err: any) {
          console.error('Supabase products.delete failed:', err);
          throw new Error(err.message || 'Failed to delete product from Supabase');
        }
      }
    }
  },

  // ----------------------------------------
  // SALES (POINT OF SALE)
  // ----------------------------------------
  sales: {
    async getAllWithItems(): Promise<SaleWithItems[]> {
      if (isSupabaseConfigured && supabase) {
        try {
          // Fetch sales
          const { data: sales, error: salesErr } = await supabase
            .from('sales')
            .select('*')
            .order('created_at', { ascending: false });
          if (salesErr) throw salesErr;

          // Fetch sale items
          const { data: items, error: itemsErr } = await supabase
            .from('sale_items')
            .select('*');
          if (itemsErr) throw itemsErr;

          // Combine them
          return (sales || []).map(sale => ({
            ...sale,
            items: (items || []).filter(item => item.sale_id === sale.id)
          }));
        } catch (err) {
          console.warn('Supabase sales.getAllWithItems failed, falling back to LocalStorage:', err);
          const sales = getMockData<Sale>(MOCK_SALES_KEY);
          const items = getMockData<SaleItem>(MOCK_SALE_ITEMS_KEY);

          const combined = sales.map(sale => ({
            ...sale,
            items: items.filter(item => item.sale_id === sale.id)
          }));

          // Sort descending by date
          return combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
      } else {
        const sales = getMockData<Sale>(MOCK_SALES_KEY);
        const items = getMockData<SaleItem>(MOCK_SALE_ITEMS_KEY);

        const combined = sales.map(sale => ({
          ...sale,
          items: items.filter(item => item.sale_id === sale.id)
        }));

        // Sort descending by date
        return combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    },

    async checkout(
      cart: { product: Product; quantity: number }[],
      paymentMethod: Sale['payment_method'],
      discount: number,
      cashier: UserProfile,
      customer?: { name?: string; phone?: string }
    ): Promise<SaleWithItems> {
      if (cart.length === 0) throw new Error('Cannot checkout an empty shopping cart');

      const saleId = 'sale-' + generateId();
      const now = new Date().toISOString();

      // Compute total amount
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

      if (isSupabaseConfigured && supabase) {
        try {
          // Start a batch or linear process in Supabase
          // 1. Insert Sales header
          const { error: saleErr } = await supabase.from('sales').insert(newSale);
          if (saleErr) throw saleErr;

          // 2. Insert Sale Items
          const { error: itemsErr } = await supabase.from('sale_items').insert(saleItems);
          if (itemsErr) throw itemsErr;

          // 3. For each item: deduct stock & add transaction
          for (const item of cart) {
            const newStock = Math.max(0, item.product.stock - item.quantity);
            // Update Stock
            await supabase
              .from('products')
              .update({ stock: newStock })
              .eq('id', item.product.id);

            // Log transaction
            await supabase.from('inventory_transactions').insert({
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
          }

          return { ...newSale, items: saleItems };
        } catch (err) {
          console.warn('Supabase sales.checkout failed, falling back to LocalStorage:', err);
          // Mock DB implementation
          const sales = getMockData<Sale>(MOCK_SALES_KEY);
          const savedItems = getMockData<SaleItem>(MOCK_SALE_ITEMS_KEY);
          const products = getMockData<Product>(MOCK_PRODUCTS_KEY);
          const transactions = getMockData<InventoryTransaction>(MOCK_TRANSACTIONS_KEY);

          // Update local products stock
          cart.forEach(item => {
            const pIdx = products.findIndex(p => p.id === item.product.id);
            if (pIdx !== -1) {
              products[pIdx].stock = Math.max(0, products[pIdx].stock - item.quantity);
            }

            // Record Inventory Transaction
            transactions.push({
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
          });

          sales.push(newSale);
          savedItems.push(...saleItems);

          saveMockData(MOCK_SALES_KEY, sales);
          saveMockData(MOCK_SALE_ITEMS_KEY, savedItems);
          saveMockData(MOCK_PRODUCTS_KEY, products);
          saveMockData(MOCK_TRANSACTIONS_KEY, transactions);

          return { ...newSale, items: saleItems };
        }
      } else {
        // Mock DB implementation
        const sales = getMockData<Sale>(MOCK_SALES_KEY);
        const savedItems = getMockData<SaleItem>(MOCK_SALE_ITEMS_KEY);
        const products = getMockData<Product>(MOCK_PRODUCTS_KEY);
        const transactions = getMockData<InventoryTransaction>(MOCK_TRANSACTIONS_KEY);

        // Update local products stock
        cart.forEach(item => {
          const pIdx = products.findIndex(p => p.id === item.product.id);
          if (pIdx !== -1) {
            products[pIdx].stock = Math.max(0, products[pIdx].stock - item.quantity);
          }

          // Record Inventory Transaction
          transactions.push({
            id: generateId(),
            product_id: item.product.id,
            product_name: item.product.name,
            type: 'sale',
            quantity: item.quantity,
            notes: `Sold at POS to ${customer?.name || 'Walk-in Customer'}`,
            performed_by: cashier.name,
            created_at: now
          });
        });

        sales.push(newSale);
        savedItems.push(...saleItems);

        saveMockData(MOCK_SALES_KEY, sales);
        saveMockData(MOCK_SALE_ITEMS_KEY, savedItems);
        saveMockData(MOCK_PRODUCTS_KEY, products);
        saveMockData(MOCK_TRANSACTIONS_KEY, transactions);

        return { ...newSale, items: saleItems };
      }
    },

    async voidSale(saleId: string, performedBy: string): Promise<void> {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: sale, error: fetchErr } = await supabase
            .from('sales')
            .select('*')
            .eq('id', saleId)
            .single();
          if (fetchErr || !sale) throw new Error('Sale not found');

          const { data: items } = await supabase
            .from('sale_items')
            .select('*')
            .eq('sale_id', saleId);

          if (items && items.length > 0) {
            for (const item of items) {
              await supabase.rpc('increment_stock', {
                p_product_id: item.product_id,
                p_quantity: item.quantity
              }).then(() => {}).catch(() => {
                supabase.from('products').select('stock').eq('id', item.product_id).single().then(({ data }) => {
                  if (data) {
                    supabase.from('products').update({ stock: data.stock + item.quantity }).eq('id', item.product_id);
                  }
                });
              });

              await supabase.from('inventory_transactions').insert({
                id: generateId(),
                product_id: item.product_id,
                product_name: item.product_name,
                branch_id: sale.branch_id,
                branch_name: sale.branch_name,
                type: 'adjustment',
                quantity: item.quantity,
                notes: `Void sale ${saleId} - stock restored`,
                performed_by: performedBy,
                created_at: new Date().toISOString()
              });
            }
          }

          await supabase.from('sales').delete().eq('id', saleId);
          await supabase.from('sale_items').delete().eq('sale_id', saleId);
        } catch (err: any) {
          console.error('Supabase voidSale error:', err);
          throw new Error(err.message || 'Failed to void sale');
        }
      } else {
        const sales = getMockData<Sale>(MOCK_SALES_KEY);
        const saleItems = getMockData<SaleItem>(MOCK_SALE_ITEMS_KEY);
        const products = getMockData<Product>(MOCK_PRODUCTS_KEY);
        const transactions = getMockData<InventoryTransaction>(MOCK_TRANSACTIONS_KEY);

        const sale = sales.find(s => s.id === saleId);
        if (!sale) throw new Error('Sale not found');

        const items = saleItems.filter(i => i.sale_id === saleId);
        items.forEach(item => {
          const pIdx = products.findIndex(p => p.id === item.product_id);
          if (pIdx !== -1) {
            products[pIdx].stock += item.quantity;
          }
          transactions.push({
            id: generateId(),
            product_id: item.product_id,
            product_name: item.product_name,
            branch_id: sale.branch_id,
            branch_name: sale.branch_name,
            type: 'adjustment',
            quantity: item.quantity,
            notes: `Void sale ${saleId} - stock restored`,
            performed_by: performedBy,
            created_at: new Date().toISOString()
          });
        });

        saveMockData(MOCK_SALES_KEY, sales.filter(s => s.id !== saleId));
        saveMockData(MOCK_SALE_ITEMS_KEY, saleItems.filter(i => i.sale_id !== saleId));
        saveMockData(MOCK_PRODUCTS_KEY, products);
        saveMockData(MOCK_TRANSACTIONS_KEY, transactions);
      }
    }
  },

  // ----------------------------------------
  // CASH FLOW (INCOME / EXPENSE LEDGER)
  // ----------------------------------------
  cashFlow: {
    async getAll(): Promise<CashFlowEntry[]> {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('cash_flow')
            .select('*')
            .order('created_at', { ascending: false });
          if (error) throw error;
          return data || [];
        } catch (err) {
          console.warn('Supabase cashFlow.getAll failed, falling back to LocalStorage:', err);
          const entries = getMockData<CashFlowEntry>(MOCK_CASHFLOW_KEY);
          return entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
      } else {
        const entries = getMockData<CashFlowEntry>(MOCK_CASHFLOW_KEY);
        return entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    },

    async create(entry: Omit<CashFlowEntry, 'id' | 'created_at'>, performedBy: string): Promise<CashFlowEntry> {
      const newEntry: CashFlowEntry = {
        ...entry,
        amount: Number(Number(entry.amount).toFixed(2)),
        performed_by: performedBy,
        id: 'cf-' + generateId(),
        created_at: new Date().toISOString()
      };

      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('cash_flow')
            .insert(newEntry)
            .select()
            .single();
          if (error) throw error;
          return data;
        } catch (err) {
          console.warn('Supabase cashFlow.create failed, falling back to LocalStorage:', err);
          const entries = getMockData<CashFlowEntry>(MOCK_CASHFLOW_KEY);
          entries.push(newEntry);
          saveMockData(MOCK_CASHFLOW_KEY, entries);
          return newEntry;
        }
      } else {
        const entries = getMockData<CashFlowEntry>(MOCK_CASHFLOW_KEY);
        entries.push(newEntry);
        saveMockData(MOCK_CASHFLOW_KEY, entries);
        return newEntry;
      }
    },

    async update(id: string, updates: Partial<Omit<CashFlowEntry, 'id' | 'created_at'>>): Promise<CashFlowEntry> {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('cash_flow')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
          if (error) throw error;
          return data;
        } catch (err) {
          console.warn('Supabase cashFlow.update failed, falling back to LocalStorage:', err);
          const entries = getMockData<CashFlowEntry>(MOCK_CASHFLOW_KEY);
          const idx = entries.findIndex(e => e.id === id);
          if (idx === -1) throw new Error('Cash flow entry not found');
          entries[idx] = { ...entries[idx], ...updates };
          saveMockData(MOCK_CASHFLOW_KEY, entries);
          return entries[idx];
        }
      } else {
        const entries = getMockData<CashFlowEntry>(MOCK_CASHFLOW_KEY);
        const idx = entries.findIndex(e => e.id === id);
        if (idx === -1) throw new Error('Cash flow entry not found');
        entries[idx] = { ...entries[idx], ...updates };
        saveMockData(MOCK_CASHFLOW_KEY, entries);
        return entries[idx];
      }
    },

    async delete(id: string): Promise<void> {
      const entries = getMockData<CashFlowEntry>(MOCK_CASHFLOW_KEY);
      saveMockData(MOCK_CASHFLOW_KEY, entries.filter(e => e.id !== id));

      if (isSupabaseConfigured && supabase) {
        try {
          const { error } = await supabase.from('cash_flow').delete().eq('id', id);
          if (error) {
            console.error('Supabase cashFlow.delete error:', error);
            throw error;
          }
        } catch (err: any) {
          console.error('Supabase cashFlow.delete failed:', err);
          throw new Error(err.message || 'Failed to delete cash flow entry from Supabase');
        }
      }
    }
  },

  // ----------------------------------------
  // TRANSACTION LOGS
  // ----------------------------------------
  transactions: {
    async getAll(): Promise<InventoryTransaction[]> {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('inventory_transactions')
            .select('*')
            .order('created_at', { ascending: false });
          if (error) throw error;
          return data || [];
        } catch (err) {
          console.warn('Supabase transactions.getAll failed, falling back to LocalStorage:', err);
          const txs = getMockData<InventoryTransaction>(MOCK_TRANSACTIONS_KEY);
          return txs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
      } else {
        const txs = getMockData<InventoryTransaction>(MOCK_TRANSACTIONS_KEY);
        return txs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    }
  },

  // ----------------------------------------
  // BUSINESS BRANDING & SETTINGS
  // ----------------------------------------
  business: {
    async get(): Promise<BusinessProfile> {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('business_settings')
            .select('*')
            .limit(1)
            .maybeSingle();
          if (data) return { ...DEFAULT_BUSINESS_PROFILE, ...data };
        } catch (err) {
          console.warn('Supabase business.get failed, falling back to LocalStorage:', err);
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

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('business_settings').upsert({ id: 'main', ...updated });
        } catch (err) {
          console.warn('Supabase business.update failed:', err);
        }
      }

      return updated;
    }
  },

  // ----------------------------------------
  // OFFLINE SYNC ENGINE
  // ----------------------------------------
  sync: {
    async syncOfflineData(): Promise<{ syncedCount: number; success: boolean; message: string }> {
      if (!isSupabaseConfigured || !supabase) {
        return { syncedCount: 0, success: false, message: 'Supabase is not configured yet.' };
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return { syncedCount: 0, success: false, message: 'Device is currently offline.' };
      }

      try {
        let syncedCount = 0;

        // 1. Sync local branches
        const localBranches = getMockData<Branch>(MOCK_BRANCHES_KEY);
        if (localBranches.length > 0) {
          const { error } = await supabase.from('branches').upsert(localBranches);
          if (!error) syncedCount += localBranches.length;
        }

        // 2. Sync local profiles
        const localProfiles = getMockData<UserProfile>(MOCK_PROFILES_KEY);
        if (localProfiles.length > 0) {
          const { error } = await supabase.from('profiles').upsert(localProfiles);
          if (!error) syncedCount += localProfiles.length;
        }

        // 3. Sync local products
        const localProducts = getMockData<Product>(MOCK_PRODUCTS_KEY);
        if (localProducts.length > 0) {
          const { error } = await supabase.from('products').upsert(localProducts);
          if (!error) syncedCount += localProducts.length;
        }

        // 4. Sync local sales
        const localSales = getMockData<Sale>(MOCK_SALES_KEY);
        if (localSales.length > 0) {
          const { error } = await supabase.from('sales').upsert(localSales);
          if (!error) syncedCount += localSales.length;
        }

        // 5. Sync local sale_items
        const localSaleItems = getMockData<SaleItem>(MOCK_SALE_ITEMS_KEY);
        if (localSaleItems.length > 0) {
          const { error } = await supabase.from('sale_items').upsert(localSaleItems);
          if (!error) syncedCount += localSaleItems.length;
        }

        // 6. Sync local transactions
        const localTxs = getMockData<InventoryTransaction>(MOCK_TRANSACTIONS_KEY);
        if (localTxs.length > 0) {
          const { error } = await supabase.from('inventory_transactions').upsert(localTxs);
          if (!error) syncedCount += localTxs.length;
        }

        // 7. Sync local cash flow entries
        const localCashFlow = getMockData<CashFlowEntry>(MOCK_CASHFLOW_KEY);
        if (localCashFlow.length > 0) {
          const { error } = await supabase.from('cash_flow').upsert(localCashFlow);
          if (!error) syncedCount += localCashFlow.length;
        }

        return {
          syncedCount,
          success: true,
          message: `Successfully synced ${syncedCount} records to Supabase!`
        };
      } catch (err: any) {
        console.error('Sync error:', err);
        return {
          syncedCount: 0,
          success: false,
          message: err.message || 'Failed to sync offline data.'
        };
      }
    }
  }
};