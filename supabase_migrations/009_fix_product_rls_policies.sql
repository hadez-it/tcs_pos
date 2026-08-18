CREATE OR REPLACE FUNCTION public.current_user_can_manage_product(target_branch_id text)
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
  ELSE
    RETURN false;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_can_manage_product(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_can_manage_product(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_product(text) TO authenticated;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;
CREATE POLICY "Authenticated users can read products"
  ON public.products FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Owners can insert products" ON public.products;
DROP POLICY IF EXISTS "Authorized users can insert products" ON public.products;
CREATE POLICY "Authorized users can insert products"
  ON public.products FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND public.current_user_can_manage_product(branch_id)
  );

DROP POLICY IF EXISTS "Owners can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
CREATE POLICY "Authenticated users can update products"
  ON public.products FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Owners can delete products" ON public.products;
DROP POLICY IF EXISTS "Authorized users can delete products" ON public.products;
CREATE POLICY "Authorized users can delete products"
  ON public.products FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND public.current_user_can_manage_product(branch_id)
  );

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own branch inventory_transactions" ON public.inventory_transactions;
DROP POLICY IF EXISTS "Authorized users can read inventory_transactions" ON public.inventory_transactions;
CREATE POLICY "Authorized users can read inventory_transactions"
  ON public.inventory_transactions FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      public.current_user_can_manage_product(branch_id)
      OR branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert own branch inventory_transactions" ON public.inventory_transactions;
DROP POLICY IF EXISTS "Authorized users can insert inventory_transactions" ON public.inventory_transactions;
CREATE POLICY "Authorized users can insert inventory_transactions"
  ON public.inventory_transactions FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (
      public.current_user_can_manage_product(branch_id)
      OR branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
    )
  );
