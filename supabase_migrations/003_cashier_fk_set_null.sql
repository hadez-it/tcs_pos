CREATE OR REPLACE FUNCTION public.repoint_cashier_fks(_tbl text)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  tbl_real text;
  r RECORD;
BEGIN
  SELECT t.oid::regclass::text INTO tbl_real
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE t.relname ILIKE _tbl AND n.nspname = 'public'
  ORDER BY (t.relname = _tbl) DESC, t.relname
  LIMIT 1;

  IF tbl_real IS NULL THEN
    RAISE NOTICE 'Table "%" not found, skipping', _tbl;
    RETURN;
  END IF;

  FOR r IN
    SELECT c.conname AS cn
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.conrelid = tbl_real::regclass
      AND c.confrelid = 'public.profiles'::regclass
  LOOP
    EXECUTE 'ALTER TABLE ' || tbl_real || ' DROP CONSTRAINT ' || quote_ident(r.cn);
    EXECUTE 'ALTER TABLE ' || tbl_real ||
            ' ADD CONSTRAINT ' || quote_ident(r.cn) ||
            ' FOREIGN KEY (cashier_id) REFERENCES public.profiles(id) ON DELETE SET NULL';
    RAISE NOTICE 'Repointed FK % on %', r.cn, tbl_real;
  END LOOP;
END;
$fn$;

SELECT public.repoint_cashier_fks('sales');
SELECT public.repoint_cashier_fks('sale_delete_requests');

DROP FUNCTION public.repoint_cashier_fks(text);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sales' AND policyname = 'Owners can update sales'
  ) THEN
    CREATE POLICY "Owners can update sales"
      ON public.sales FOR UPDATE
      USING (public.current_user_is_owner());
  END IF;
END $$;
