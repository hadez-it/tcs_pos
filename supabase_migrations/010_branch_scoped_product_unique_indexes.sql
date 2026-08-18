-- ── Migration 010: Branch Scoped Product Unique Indexes ────────────────
-- Allows identical SKU and Barcode across multiple branches with branch-specific stock counts

DROP INDEX IF EXISTS public.products_sku_unique_idx;
DROP INDEX IF EXISTS public.products_barcode_unique_idx;
DROP INDEX IF EXISTS public.products_sku_branch_unique_idx;
DROP INDEX IF EXISTS public.products_barcode_branch_unique_idx;

CREATE UNIQUE INDEX products_sku_branch_unique_idx
  ON public.products (upper(sku), COALESCE(branch_id, ''))
  WHERE sku IS NOT NULL AND sku <> '';

CREATE UNIQUE INDEX products_barcode_branch_unique_idx
  ON public.products (barcode, COALESCE(branch_id, ''))
  WHERE barcode IS NOT NULL AND barcode <> '';
