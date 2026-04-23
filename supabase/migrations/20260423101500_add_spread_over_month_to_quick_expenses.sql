ALTER TABLE public.quick_expenses
  ADD COLUMN IF NOT EXISTS spread_over_month boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_quick_expenses_user_spread_over_month
  ON public.quick_expenses(user_id, spread_over_month);
