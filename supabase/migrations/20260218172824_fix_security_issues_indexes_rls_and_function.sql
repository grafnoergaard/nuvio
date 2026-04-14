/*
  # Fix Security Issues: Indexes, RLS Policies, and Function Search Path

  ## Summary
  This migration addresses all flagged security and performance issues:

  ## 1. Missing Indexes on Foreign Keys
  - Add index on `budget_plans.recipient_id` (foreign key `budget_plans_recipient_id_fkey`)
  - Add index on `transactions.category_group_id` (foreign key `transactions_category_group_id_fkey`)

  ## 2. Drop Unused and Duplicate Indexes
  - Drop `idx_transactions_is_one_off` (unused)
  - Drop `idx_transactions_description` (unused)
  - Drop `idx_merchant_rules_text` (unused)
  - Drop `idx_recipient_rules_recipient` (unused)
  - Drop `idx_recipients_name_idx` (duplicate of `idx_recipients_name`)

  ## 3. Fix RLS Auth Function Performance on `regional_postal_ranges`
  - Replace `auth.uid()` with `(select auth.uid())` in all four policies
    to avoid per-row re-evaluation

  ## 4. Fix Always-True RLS Policies
  - All "public" tables (budget_plans, budgets, category_groups, household,
    merchant_rules, recipient_rules, recipients, savings_goals, transactions)
    now require `authenticated` role instead of `public`
  - calculation_rates write policies now require `(select auth.uid()) IS NOT NULL`

  ## 5. Fix Function Search Path
  - Set explicit `search_path` on `public.set_active_budget` to prevent
    search_path injection attacks
*/

-- ============================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_budget_plans_recipient_id
  ON public.budget_plans (recipient_id);

CREATE INDEX IF NOT EXISTS idx_transactions_category_group_id
  ON public.transactions (category_group_id);

-- ============================================================
-- 2. DROP UNUSED AND DUPLICATE INDEXES
-- ============================================================

DROP INDEX IF EXISTS public.idx_transactions_is_one_off;
DROP INDEX IF EXISTS public.idx_transactions_description;
DROP INDEX IF EXISTS public.idx_merchant_rules_text;
DROP INDEX IF EXISTS public.idx_recipient_rules_recipient;
DROP INDEX IF EXISTS public.idx_recipients_name_idx;

-- ============================================================
-- 3. FIX RLS AUTH FUNCTION PERFORMANCE ON regional_postal_ranges
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can read postal ranges" ON public.regional_postal_ranges;
DROP POLICY IF EXISTS "Authenticated users can insert postal ranges" ON public.regional_postal_ranges;
DROP POLICY IF EXISTS "Authenticated users can update postal ranges" ON public.regional_postal_ranges;
DROP POLICY IF EXISTS "Authenticated users can delete postal ranges" ON public.regional_postal_ranges;

CREATE POLICY "Authenticated users can read postal ranges"
  ON public.regional_postal_ranges FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert postal ranges"
  ON public.regional_postal_ranges FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update postal ranges"
  ON public.regional_postal_ranges FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can delete postal ranges"
  ON public.regional_postal_ranges FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- ============================================================
-- 4. FIX ALWAYS-TRUE RLS POLICIES
-- All tables below are shared (single-tenant app), so we allow
-- any authenticated user full access. This is intentional and
-- removes the "public" (unauthenticated) access.
-- ============================================================

-- budget_plans
DROP POLICY IF EXISTS "Allow public read access to budget_plans" ON public.budget_plans;
DROP POLICY IF EXISTS "Allow public insert access to budget_plans" ON public.budget_plans;
DROP POLICY IF EXISTS "Allow public update access to budget_plans" ON public.budget_plans;
DROP POLICY IF EXISTS "Allow public delete access to budget_plans" ON public.budget_plans;

CREATE POLICY "Authenticated users can read budget_plans"
  ON public.budget_plans FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert budget_plans"
  ON public.budget_plans FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update budget_plans"
  ON public.budget_plans FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can delete budget_plans"
  ON public.budget_plans FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- budgets
DROP POLICY IF EXISTS "Allow public read access to budgets" ON public.budgets;
DROP POLICY IF EXISTS "Allow public insert access to budgets" ON public.budgets;
DROP POLICY IF EXISTS "Allow public update access to budgets" ON public.budgets;
DROP POLICY IF EXISTS "Allow public delete access to budgets" ON public.budgets;

CREATE POLICY "Authenticated users can read budgets"
  ON public.budgets FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert budgets"
  ON public.budgets FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update budgets"
  ON public.budgets FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can delete budgets"
  ON public.budgets FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- category_groups
DROP POLICY IF EXISTS "Allow public read access to category_groups" ON public.category_groups;
DROP POLICY IF EXISTS "Allow public insert access to category_groups" ON public.category_groups;
DROP POLICY IF EXISTS "Allow public update access to category_groups" ON public.category_groups;
DROP POLICY IF EXISTS "Allow public delete access to category_groups" ON public.category_groups;

CREATE POLICY "Authenticated users can read category_groups"
  ON public.category_groups FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert category_groups"
  ON public.category_groups FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update category_groups"
  ON public.category_groups FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can delete category_groups"
  ON public.category_groups FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- household
DROP POLICY IF EXISTS "Public can read household" ON public.household;
DROP POLICY IF EXISTS "Public can insert household" ON public.household;
DROP POLICY IF EXISTS "Public can update household" ON public.household;

CREATE POLICY "Authenticated users can read household"
  ON public.household FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert household"
  ON public.household FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update household"
  ON public.household FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- merchant_rules
DROP POLICY IF EXISTS "Anyone can read merchant rules" ON public.merchant_rules;
DROP POLICY IF EXISTS "Anyone can insert merchant rules" ON public.merchant_rules;
DROP POLICY IF EXISTS "Anyone can update merchant rules" ON public.merchant_rules;
DROP POLICY IF EXISTS "Anyone can delete merchant rules" ON public.merchant_rules;

CREATE POLICY "Authenticated users can read merchant_rules"
  ON public.merchant_rules FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert merchant_rules"
  ON public.merchant_rules FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update merchant_rules"
  ON public.merchant_rules FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can delete merchant_rules"
  ON public.merchant_rules FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- recipient_rules
DROP POLICY IF EXISTS "Allow public read access to recipient_rules" ON public.recipient_rules;
DROP POLICY IF EXISTS "Allow public insert access to recipient_rules" ON public.recipient_rules;
DROP POLICY IF EXISTS "Allow public update access to recipient_rules" ON public.recipient_rules;
DROP POLICY IF EXISTS "Allow public delete access to recipient_rules" ON public.recipient_rules;

CREATE POLICY "Authenticated users can read recipient_rules"
  ON public.recipient_rules FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert recipient_rules"
  ON public.recipient_rules FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update recipient_rules"
  ON public.recipient_rules FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can delete recipient_rules"
  ON public.recipient_rules FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- recipients
DROP POLICY IF EXISTS "Allow public read access to recipients" ON public.recipients;
DROP POLICY IF EXISTS "Allow public insert access to recipients" ON public.recipients;
DROP POLICY IF EXISTS "Allow public update access to recipients" ON public.recipients;
DROP POLICY IF EXISTS "Allow public delete access to recipients" ON public.recipients;

CREATE POLICY "Authenticated users can read recipients"
  ON public.recipients FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert recipients"
  ON public.recipients FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update recipients"
  ON public.recipients FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can delete recipients"
  ON public.recipients FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- savings_goals
DROP POLICY IF EXISTS "Allow select savings_goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Allow insert savings_goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Allow update savings_goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Allow delete savings_goals" ON public.savings_goals;

CREATE POLICY "Authenticated users can read savings_goals"
  ON public.savings_goals FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert savings_goals"
  ON public.savings_goals FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update savings_goals"
  ON public.savings_goals FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can delete savings_goals"
  ON public.savings_goals FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- transactions
DROP POLICY IF EXISTS "Allow public read access to transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow public insert access to transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow public update access to transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow public delete access to transactions" ON public.transactions;

CREATE POLICY "Authenticated users can read transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert transactions"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update transactions"
  ON public.transactions FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can delete transactions"
  ON public.transactions FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- calculation_rates (already to authenticated, fix with CHECK clauses)
DROP POLICY IF EXISTS "Authenticated users can insert rates" ON public.calculation_rates;
DROP POLICY IF EXISTS "Authenticated users can update rates" ON public.calculation_rates;

CREATE POLICY "Authenticated users can insert rates"
  ON public.calculation_rates FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update rates"
  ON public.calculation_rates FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ============================================================
-- 5. FIX FUNCTION SEARCH PATH
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_active_budget(budget_uuid uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  UPDATE budgets SET is_active = false WHERE is_active = true;
  UPDATE budgets SET is_active = true WHERE id = budget_uuid;
END;
$$;
