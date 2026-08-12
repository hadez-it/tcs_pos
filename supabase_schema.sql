-- ============================================================
-- Mibaya POS — Final Supabase Schema
-- Run this in Supabase SQL Editor to set up all tables, RLS,
-- and the auth trigger. Safe to re-run (uses IF NOT EXISTS).
-- ============================================================

-- ── 0. Clean slate ────────────────────────────────────────────
DROP TABLE IF EXISTS public.cash_flow CASCADE;
DROP TABLE IF EXISTS public.inventory_transactions CASCADE;
DROP TABLE IF EXISTS public.sale_items CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.branches CASCADE;
DROP TABLE IF EXISTS public.business_settings CASCADE;

-- ── 1. Profiles ──────────────────────────────────────────────
CREATE TABLE public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    role        TEXT NOT NULL CHECK (role IN ('owner', 'cashier', 'manager')),
    branch_id   TEXT,
    branch_name TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Yangon', now())
);

-- Helper function to check if current user is an owner.
-- SECURITY DEFINER so the query on profiles bypasses RLS and avoids recursion.
CREATE OR REPLACE FUNCTION public.current_user_is_owner()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'owner'
  );
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Owners can read all profiles"
  ON public.profiles FOR SELECT
  USING (public.current_user_is_owner());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Owners can manage all profiles"
  ON public.profiles FOR ALL
  USING (public.current_user_is_owner());

-- Auto-create profile on new Supabase Auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'owner')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── 2. Branches ──────────────────────────────────────────────
CREATE TABLE public.branches (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    code        TEXT NOT NULL UNIQUE,
    address     TEXT NOT NULL,
    phone       TEXT NOT NULL,
    manager_id  UUID,
    manager_name TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Yangon', now())
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read branches"
  ON public.branches FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Only owners can modify branches"
  ON public.branches FOR ALL
  USING (public.current_user_is_owner());


-- Add FK constraint after branches table exists
ALTER TABLE public.profiles ADD CONSTRAINT profiles_branch_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);
-- ── 3. Products ──────────────────────────────────────────────
CREATE TABLE public.products (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    sku             TEXT,
    barcode         TEXT,
    price           NUMERIC NOT NULL DEFAULT 0,
    cost            NUMERIC NOT NULL DEFAULT 0,
    stock           INTEGER NOT NULL DEFAULT 0,
    min_stock_level INTEGER NOT NULL DEFAULT 5,
    category        TEXT DEFAULT 'General',
    image           TEXT,
    description     TEXT,
    use_stock       BOOLEAN DEFAULT true,
    unit_amount     NUMERIC DEFAULT 1,
    unit_name       TEXT DEFAULT 'pcs',
    price_variant   TEXT,
    expiry_date     TEXT,
    updated_at      TEXT,
    branch_id       TEXT REFERENCES public.branches(id),
    branch_name     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Yangon', now())
);

-- SKU / barcode must be unique across the catalog. Partial indexes so the many
-- legacy rows with a blank code do not collide with each other.
CREATE UNIQUE INDEX products_sku_unique_idx
  ON public.products (upper(sku))
  WHERE sku IS NOT NULL AND sku <> '';

CREATE UNIQUE INDEX products_barcode_unique_idx
  ON public.products (barcode)
  WHERE barcode IS NOT NULL AND barcode <> '';

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read products"
  ON public.products FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Owners can insert products"
  ON public.products FOR INSERT
  WITH CHECK (public.current_user_is_owner());

CREATE POLICY "Authenticated users can update products"
  ON public.products FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Owners can delete products"
  ON public.products FOR DELETE
  USING (public.current_user_is_owner());

-- ── 4. Sales ─────────────────────────────────────────────────
CREATE TABLE public.sales (
    id              TEXT PRIMARY KEY,
    cashier_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    cashier_name    TEXT NOT NULL,
    branch_id       TEXT REFERENCES public.branches(id),
    branch_name     TEXT,
    total_amount    NUMERIC NOT NULL,
    discount        NUMERIC NOT NULL DEFAULT 0,
    payment_method  TEXT NOT NULL,
    customer_name   TEXT,
    customer_phone  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Yangon', now())
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cashiers can read own sales"
  ON public.sales FOR SELECT
  USING (
    cashier_id = auth.uid()
    OR public.current_user_is_owner()
  );

CREATE POLICY "Cashiers can insert sales"
  ON public.sales FOR INSERT
  WITH CHECK (cashier_id = auth.uid());

CREATE POLICY "Owners can update sales"
  ON public.sales FOR UPDATE
  USING (public.current_user_is_owner());

CREATE POLICY "Owners can delete sales (void)"
  ON public.sales FOR DELETE
  USING (public.current_user_is_owner());

-- ── 5. Sale Items ────────────────────────────────────────────
CREATE TABLE public.sale_items (
    id          TEXT PRIMARY KEY,
    sale_id     TEXT REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id  TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity    INTEGER NOT NULL,
    unit_price  NUMERIC NOT NULL,
    unit_cost   NUMERIC NOT NULL,
    total       NUMERIC NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Yangon', now())
);

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sale_items"
  ON public.sale_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert sale_items"
  ON public.sale_items FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Owners can delete sale_items (void)"
  ON public.sale_items FOR DELETE
  USING (public.current_user_is_owner());

-- ── 6. Inventory Transactions ────────────────────────────────
CREATE TABLE public.inventory_transactions (
    id          TEXT PRIMARY KEY,
    product_id  TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    branch_id   TEXT NOT NULL REFERENCES public.branches(id),
    branch_name TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('stock-in', 'stock-out', 'sale', 'adjustment')),
    quantity    INTEGER NOT NULL,
    notes       TEXT,
    performed_by TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Yangon', now())
);

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own branch inventory_transactions"
  ON public.inventory_transactions FOR SELECT
  USING (branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'));

CREATE POLICY "Users can insert own branch inventory_transactions"
  ON public.inventory_transactions FOR INSERT
  WITH CHECK (branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
              OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'));

-- ── 7. Business Settings ─────────────────────────────────────
CREATE TABLE public.business_settings (
    id              TEXT PRIMARY KEY DEFAULT 'main',
    name            TEXT NOT NULL DEFAULT 'RetailHub',
    tagline         TEXT DEFAULT 'Multi-branch Retail POS System',
    logo_url        TEXT DEFAULT '',
    phone           TEXT DEFAULT '',
    email           TEXT DEFAULT '',
    address         TEXT DEFAULT '',
    tax_rate        NUMERIC DEFAULT 5,
    receipt_footer  TEXT DEFAULT 'Thank you for shopping with us! Please come again.',
    currency        TEXT DEFAULT 'Ks',
    updated_at      TIMESTAMPTZ DEFAULT timezone('Asia/Yangon', now())
);

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read business_settings"
  ON public.business_settings FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Only owners can update business_settings"
  ON public.business_settings FOR ALL
  USING (public.current_user_is_owner());

-- Insert default row so upsert works
INSERT INTO public.business_settings (id)
VALUES ('main')
ON CONFLICT (id) DO NOTHING;

-- ── 8. Cash Flow Ledger ──────────────────────────────────────
CREATE TABLE public.cash_flow (
    id             TEXT PRIMARY KEY,
    type           TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category       TEXT NOT NULL DEFAULT 'Other',
    title          TEXT NOT NULL,
    amount         NUMERIC NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    branch_id      TEXT REFERENCES public.branches(id),
    branch_name    TEXT,
    notes          TEXT,
    performed_by   TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Yangon', now())
);

ALTER TABLE public.cash_flow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cash_flow"
  ON public.cash_flow FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Owners can manage cash_flow"
  ON public.cash_flow FOR ALL
  USING (public.current_user_is_owner());

-- ── 9. Sale Delete Requests ──────────────────────────────────
CREATE TABLE public.sale_delete_requests (
    id               TEXT PRIMARY KEY,
    sale_id          TEXT REFERENCES public.sales(id) ON DELETE SET NULL,
    cashier_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    cashier_name     TEXT NOT NULL,
    branch_id        TEXT REFERENCES public.branches(id),
    branch_name      TEXT,
    total_amount     NUMERIC NOT NULL,
    reason           TEXT,
    status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at     TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Yangon', now()),
    reviewed_at      TIMESTAMPTZ,
    reviewed_by      TEXT,
    rejection_reason TEXT
);

ALTER TABLE public.sale_delete_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sale_delete_requests"
  ON public.sale_delete_requests FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Cashiers can insert sale_delete_requests"
  ON public.sale_delete_requests FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Owners can update sale_delete_requests"
  ON public.sale_delete_requests FOR UPDATE
  USING (public.current_user_is_owner());

CREATE POLICY "Owners can delete sale_delete_requests"
  ON public.sale_delete_requests FOR DELETE
  USING (public.current_user_is_owner());
