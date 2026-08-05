-- ============================================================
-- Mibaya POS — Migration 001: Allow product deletes/updates
-- Make sale_items.product_id and inventory_transactions.product_id
-- use ON DELETE SET NULL so historical rows survive product deletion.
-- Safe to re-run. Does NOT drop any data.
-- ============================================================

CREATE OR REPLACE FUNCTION public.repoint_product_fks(_tbl text)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  tbl_real text;
  r RECORD;
BEGIN
  -- Resolve the actual table, tolerant of case / the historical typo.
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

  -- Drop every FK on this table that points at products, then re-add
  -- with ON DELETE SET NULL.
  FOR r IN
    SELECT c.conname AS cn
    FROM pg_constraint c
    WHERE c.conftype = 'f'
      AND c.conrelid = tbl_real::regclass
      AND c.confrelid = 'public.products'::regclass
  LOOP
    EXECUTE 'ALTER TABLE ' || tbl_real || ' DROP CONSTRAINT ' || quote_ident(r.cn);
    EXECUTE 'ALTER TABLE ' || tbl_real ||
            ' ADD CONSTRAINT ' || quote_ident(r.cn) ||
            ' FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL';
    RAISE NOTICE 'Repointed FK % on %', r.cn, tbl_real;
  END LOOP;
END;
$fn$;

SELECT public.repoint_product_fks('sale_items');
SELECT public.repoint_product_fks('inventory_transactions');
SELECT public.repoint_product_fks('inventory_transactuons');

DROP FUNCTION public.repoint_product_fks(text);