/*
  # Fix Indexes: recipient_rules foreign key + drop unused indexes

  ## Changes
  1. Add covering index on `recipient_rules.recipient_id` (missing FK index)
  2. Drop `idx_budget_plans_recipient_id` (flagged as unused)
  3. Drop `idx_transactions_category_group_id` (flagged as unused)

  ## Notes
  - The two dropped indexes were added in a previous migration but flagged
    as unused by the query planner. The FK constraints still enforce integrity.
  - Auth DB Connection Strategy and Leaked Password Protection must be
    configured manually in the Supabase Dashboard.
*/

CREATE INDEX IF NOT EXISTS idx_recipient_rules_recipient_id
  ON public.recipient_rules (recipient_id);

DROP INDEX IF EXISTS public.idx_budget_plans_recipient_id;
DROP INDEX IF EXISTS public.idx_transactions_category_group_id;
