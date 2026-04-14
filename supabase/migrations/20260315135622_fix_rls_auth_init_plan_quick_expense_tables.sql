/*
  # Fix RLS auth() initialization plan for quick_expense tables

  ## Summary
  Replaces bare `auth.uid()` calls with `(select auth.uid())` in RLS policies for:
  - `public.quick_expenses`
  - `public.quick_expense_budgets`
  - `public.quick_expense_monthly_budgets`
  - `public.quick_expense_month_transitions`
  - `public.quick_expense_streaks`

  This ensures auth.uid() is evaluated once per statement rather than once per row,
  improving query performance at scale.

  ## Security
  No change in access control logic — only evaluation strategy is optimized.
*/

-- quick_expenses
DROP POLICY IF EXISTS "Users can delete own quick expenses" ON public.quick_expenses;
DROP POLICY IF EXISTS "Users can insert own quick expenses" ON public.quick_expenses;
DROP POLICY IF EXISTS "Users can select own quick expenses" ON public.quick_expenses;
DROP POLICY IF EXISTS "Users can update own quick expenses" ON public.quick_expenses;

CREATE POLICY "Users can delete own quick expenses"
  ON public.quick_expenses FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own quick expenses"
  ON public.quick_expenses FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can select own quick expenses"
  ON public.quick_expenses FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own quick expenses"
  ON public.quick_expenses FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- quick_expense_budgets
DROP POLICY IF EXISTS "Users can delete own quick expense budget" ON public.quick_expense_budgets;
DROP POLICY IF EXISTS "Users can insert own quick expense budget" ON public.quick_expense_budgets;
DROP POLICY IF EXISTS "Users can select own quick expense budget" ON public.quick_expense_budgets;
DROP POLICY IF EXISTS "Users can update own quick expense budget" ON public.quick_expense_budgets;

CREATE POLICY "Users can delete own quick expense budget"
  ON public.quick_expense_budgets FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own quick expense budget"
  ON public.quick_expense_budgets FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can select own quick expense budget"
  ON public.quick_expense_budgets FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own quick expense budget"
  ON public.quick_expense_budgets FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- quick_expense_monthly_budgets
DROP POLICY IF EXISTS "Users can delete own monthly budgets" ON public.quick_expense_monthly_budgets;
DROP POLICY IF EXISTS "Users can insert own monthly budgets" ON public.quick_expense_monthly_budgets;
DROP POLICY IF EXISTS "Users can select own monthly budgets" ON public.quick_expense_monthly_budgets;
DROP POLICY IF EXISTS "Users can update own monthly budgets" ON public.quick_expense_monthly_budgets;

CREATE POLICY "Users can delete own monthly budgets"
  ON public.quick_expense_monthly_budgets FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own monthly budgets"
  ON public.quick_expense_monthly_budgets FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can select own monthly budgets"
  ON public.quick_expense_monthly_budgets FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own monthly budgets"
  ON public.quick_expense_monthly_budgets FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- quick_expense_month_transitions
DROP POLICY IF EXISTS "Users can insert own transitions" ON public.quick_expense_month_transitions;
DROP POLICY IF EXISTS "Users can select own transitions" ON public.quick_expense_month_transitions;
DROP POLICY IF EXISTS "Users can update own transitions" ON public.quick_expense_month_transitions;

CREATE POLICY "Users can insert own transitions"
  ON public.quick_expense_month_transitions FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can select own transitions"
  ON public.quick_expense_month_transitions FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own transitions"
  ON public.quick_expense_month_transitions FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- quick_expense_streaks
DROP POLICY IF EXISTS "Users can insert own streak" ON public.quick_expense_streaks;
DROP POLICY IF EXISTS "Users can select own streak" ON public.quick_expense_streaks;
DROP POLICY IF EXISTS "Users can update own streak" ON public.quick_expense_streaks;

CREATE POLICY "Users can insert own streak"
  ON public.quick_expense_streaks FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can select own streak"
  ON public.quick_expense_streaks FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own streak"
  ON public.quick_expense_streaks FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
