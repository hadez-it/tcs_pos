CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role <> OLD.role AND NOT public.current_user_is_owner() THEN
    RAISE EXCEPTION 'Unauthorized: Only owners can modify user roles';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'cashier')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.current_user_is_owner() THEN
    RAISE EXCEPTION 'Unauthorized: Only owners can delete user accounts';
  END IF;

  DELETE FROM auth.users WHERE id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.deduct_product_stock(p_product_id text, p_qty int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products
  SET stock = GREATEST(0, stock - p_qty)
  WHERE id = p_product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.deduct_product_stock(text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deduct_product_stock(text, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.deduct_product_stock(text, int) TO authenticated;

DROP POLICY IF EXISTS "Cashiers can insert sale_delete_requests" ON public.sale_delete_requests;
CREATE POLICY "Cashiers can insert sale_delete_requests"
  ON public.sale_delete_requests FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (cashier_id = auth.uid() OR cashier_id IS NULL)
    AND status = 'pending'
  );
