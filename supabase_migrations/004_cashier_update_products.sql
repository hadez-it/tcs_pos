-- Allow cashiers to update products (mainly for stock deduction during checkout)
DROP POLICY IF EXISTS "Owners can update products" ON public.products;
CREATE POLICY "Authenticated users can update products"
  ON public.products FOR UPDATE
  USING (auth.role() = 'authenticated');
