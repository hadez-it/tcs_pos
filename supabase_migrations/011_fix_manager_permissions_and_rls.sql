-- ── Migration 011: Fix Branch Manager Permissions & RLS ────────────────
-- Fixes RLS policies for Sales, Profiles, Cash Flow, and Sale Items
-- so branch manager accounts can access their branch's sales, cash flow, and staff performance.

-- 1. Helper security definer functions for branch access
CREATE OR REPLACE FUNCTION public.current_user_can_access_branch(target_branch_id text)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_user_branch text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT role, branch_id INTO v_role, v_user_branch
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role = 'owner' THEN
    RETURN true;
  ELSIF v_role = 'manager' THEN
    IF v_user_branch IS NULL OR v_user_branch = '' OR target_branch_id IS NULL OR target_branch_id = '' OR v_user_branch = target_branch_id THEN
      RETURN true;
    ELSE
      RETURN false;
    END IF;
  ELSIF v_role = 'cashier' THEN
    IF v_user_branch IS NOT NULL AND v_user_branch <> '' AND target_branch_id IS NOT NULL AND target_branch_id <> '' THEN
      RETURN v_user_branch = target_branch_id;
    ELSE
      RETURN true;
    END IF;
  ELSE
    RETURN false;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_can_access_branch(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_can_access_branch(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_access_branch(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_is_manager_or_owner()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();

  RETURN v_role IN ('owner', 'manager');
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_is_manager_or_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_is_manager_or_owner() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_manager_or_owner() TO authenticated;

-- 2. Profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Owners can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authorized users can insert profiles" ON public.profiles;
CREATE POLICY "Authorized users can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (
      auth.uid() = id
      OR public.current_user_is_manager_or_owner()
    )
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Owners can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authorized users can update profiles" ON public.profiles;
CREATE POLICY "Authorized users can update profiles"
  ON public.profiles FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND (
      auth.uid() = id
      OR public.current_user_is_manager_or_owner()
    )
  );

DROP POLICY IF EXISTS "Authorized users can delete profiles" ON public.profiles;
CREATE POLICY "Authorized users can delete profiles"
  ON public.profiles FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND public.current_user_is_manager_or_owner()
  );

-- 3. Sales RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cashiers can read own sales" ON public.sales;
DROP POLICY IF EXISTS "Authorized users can read sales" ON public.sales;
CREATE POLICY "Authorized users can read sales"
  ON public.sales FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      cashier_id = auth.uid()
      OR public.current_user_can_access_branch(branch_id)
    )
  );

DROP POLICY IF EXISTS "Cashiers can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Authorized users can insert sales" ON public.sales;
CREATE POLICY "Authorized users can insert sales"
  ON public.sales FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (
      cashier_id = auth.uid()
      OR public.current_user_can_access_branch(branch_id)
    )
  );

DROP POLICY IF EXISTS "Owners can update sales" ON public.sales;
DROP POLICY IF EXISTS "Authorized users can update sales" ON public.sales;
CREATE POLICY "Authorized users can update sales"
  ON public.sales FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND public.current_user_can_access_branch(branch_id)
  );

DROP POLICY IF EXISTS "Owners can delete sales (void)" ON public.sales;
DROP POLICY IF EXISTS "Authorized users can delete sales (void)" ON public.sales;
CREATE POLICY "Authorized users can delete sales (void)"
  ON public.sales FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND public.current_user_can_access_branch(branch_id)
  );

-- 4. Sale Items RLS
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read sale_items" ON public.sale_items;
CREATE POLICY "Authenticated users can read sale_items"
  ON public.sale_items FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert sale_items" ON public.sale_items;
CREATE POLICY "Authenticated users can insert sale_items"
  ON public.sale_items FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Owners can delete sale_items (void)" ON public.sale_items;
DROP POLICY IF EXISTS "Authorized users can delete sale_items (void)" ON public.sale_items;
CREATE POLICY "Authorized users can delete sale_items (void)"
  ON public.sale_items FOR DELETE
  USING (auth.role() = 'authenticated');

-- 5. Cash Flow RLS
ALTER TABLE public.cash_flow ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read cash_flow" ON public.cash_flow;
DROP POLICY IF EXISTS "Authorized users can read cash_flow" ON public.cash_flow;
CREATE POLICY "Authorized users can read cash_flow"
  ON public.cash_flow FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      public.current_user_can_access_branch(branch_id)
      OR branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can manage cash_flow" ON public.cash_flow;
DROP POLICY IF EXISTS "Authorized users can manage cash_flow" ON public.cash_flow;
CREATE POLICY "Authorized users can manage cash_flow"
  ON public.cash_flow FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND public.current_user_can_access_branch(branch_id)
  );

-- 6. Sale Delete Requests RLS
ALTER TABLE public.sale_delete_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read sale_delete_requests" ON public.sale_delete_requests;
CREATE POLICY "Authenticated users can read sale_delete_requests"
  ON public.sale_delete_requests FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Cashiers can insert sale_delete_requests" ON public.sale_delete_requests;
DROP POLICY IF EXISTS "Authorized users can insert sale_delete_requests" ON public.sale_delete_requests;
CREATE POLICY "Authorized users can insert sale_delete_requests"
  ON public.sale_delete_requests FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Owners can update sale_delete_requests" ON public.sale_delete_requests;
DROP POLICY IF EXISTS "Owners can delete sale_delete_requests" ON public.sale_delete_requests;
DROP POLICY IF EXISTS "Authorized users can manage sale_delete_requests" ON public.sale_delete_requests;
CREATE POLICY "Authorized users can manage sale_delete_requests"
  ON public.sale_delete_requests FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND public.current_user_can_access_branch(branch_id)
  );
