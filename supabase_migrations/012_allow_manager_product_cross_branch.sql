-- ── Migration 012: Allow Managers to Manage Products Across All Branches ──
-- Permits managers to create, update, and manage products on any branch,
-- allowing automatic creation of product entries with 0 quantity across all branches.

CREATE OR REPLACE FUNCTION public.current_user_can_manage_product(target_branch_id text)
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

REVOKE ALL ON FUNCTION public.current_user_can_manage_product(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_can_manage_product(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_product(text) TO authenticated;
