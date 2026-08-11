CREATE TABLE IF NOT EXISTS public.sale_delete_requests (
    id               TEXT PRIMARY KEY,
    sale_id          TEXT REFERENCES public.sales(id) ON DELETE SET NULL,
    cashier_id       UUID REFERENCES public.profiles(id),
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
