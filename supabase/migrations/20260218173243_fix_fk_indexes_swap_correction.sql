/*
  # Correct FK index coverage and remove unused index

  ## Changes
  1. Add covering index on `budget_plans.recipient_id` (unindexed FK)
  2. Add covering index on `transactions.category_group_id` (unindexed FK)
  3. Drop `idx_recipient_rules_recipient_id` (flagged as unused)

  ## Notes
  - FK constraints still enforce referential integrity regardless of indexes.
  - The two new indexes improve JOIN and lookup performance on these FK columns.
  - Auth DB Connection Strategy and Leaked Password Protection must be
    configured manually in the Supabase Dashboard.
*/

CREATE INDEX IF NOT EXISTS idx_budget_plans_recipient_id
  ON public.budget_plans (recipient_id);

CREATE INDEX IF NOT EXISTS idx_transactions_category_group_id
  ON public.transactions (category_group_id);

DROP INDEX IF EXISTS public.idx_recipient_rules_recipient_id;
