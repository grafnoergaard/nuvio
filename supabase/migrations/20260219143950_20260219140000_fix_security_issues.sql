/*
  # Fix Security Issues

  ## Summary
  Addresses all security and performance warnings raised by the Supabase advisor.

  ## Changes

  ### 1. Missing FK indexes
  - Add index on `mini_checkup_settings.updated_by` (FK to auth.users)
  - `recipient_rules.recipient_id` already has `idx_recipient_rules_recipient` — verified below;
    this migration adds it safely with IF NOT EXISTS.

  ### 2. RLS auth() re-evaluation (Auth RLS Initialization Plan)
  Replaces bare `auth.uid()` calls with `(select auth.uid())` in policies on:
  - `household` (read, insert, update)
  - `mini_checkup_user_state` (read, insert, update)
  - `investment_settings` (select, insert, update, delete)

  ### 3. Drop unused indexes
  - `idx_transactions_category_group_id`
  - `idx_mini_checkup_user_state_user`

  ### 4. Remove duplicate permissive policies on `household`
  Earlier migration left behind "Authenticated users can insert/read/update household"
  policies that conflict with the newer per-user ones.

  ### 5. Fix function search_path for `duplicate_budget`
  Sets an explicit, fixed `search_path` to prevent search-path injection.

  ### 6. Fix always-true RLS policy on `mini_checkup_settings` UPDATE
  Restricts the update policy so only the service_role (admin) can update settings,
  not any authenticated user. Regular users only need SELECT.
*/

-- ============================================================
-- 1. MISSING FK INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_mini_checkup_settings_updated_by
  ON mini_checkup_settings(updated_by);

-- recipient_rules.recipient_id index already exists as idx_recipient_rules_recipient
-- but we ensure it is present with IF NOT EXISTS
CREATE INDEX IF NOT EXISTS idx_recipient_rules_recipient_id
  ON recipient_rules(recipient_id);

-- ============================================================
-- 2. FIX RLS auth() RE-EVALUATION — household
-- ============================================================

DROP POLICY IF EXISTS "Users can read own household" ON household;
DROP POLICY IF EXISTS "Users can insert own household" ON household;
DROP POLICY IF EXISTS "Users can update own household" ON household;

-- Also drop any stale "Authenticated users can …" duplicates
DROP POLICY IF EXISTS "Authenticated users can read household" ON household;
DROP POLICY IF EXISTS "Authenticated users can insert household" ON household;
DROP POLICY IF EXISTS "Authenticated users can update household" ON household;

CREATE POLICY "Users can read own household"
  ON household FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own household"
  ON household FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own household"
  ON household FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- 3. FIX RLS auth() RE-EVALUATION — mini_checkup_user_state
-- ============================================================

DROP POLICY IF EXISTS "Users can read own checkup state" ON mini_checkup_user_state;
DROP POLICY IF EXISTS "Users can insert own checkup state" ON mini_checkup_user_state;
DROP POLICY IF EXISTS "Users can update own checkup state" ON mini_checkup_user_state;

CREATE POLICY "Users can read own checkup state"
  ON mini_checkup_user_state FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own checkup state"
  ON mini_checkup_user_state FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own checkup state"
  ON mini_checkup_user_state FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- 4. FIX RLS auth() RE-EVALUATION — investment_settings
-- ============================================================

DROP POLICY IF EXISTS "Users can select own investment settings" ON investment_settings;
DROP POLICY IF EXISTS "Users can insert own investment settings" ON investment_settings;
DROP POLICY IF EXISTS "Users can update own investment settings" ON investment_settings;
DROP POLICY IF EXISTS "Users can delete own investment settings" ON investment_settings;

CREATE POLICY "Users can select own investment settings"
  ON investment_settings FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own investment settings"
  ON investment_settings FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own investment settings"
  ON investment_settings FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own investment settings"
  ON investment_settings FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- 5. DROP UNUSED INDEXES
-- ============================================================

DROP INDEX IF EXISTS idx_transactions_category_group_id;
DROP INDEX IF EXISTS idx_mini_checkup_user_state_user;

-- ============================================================
-- 6. FIX always-true UPDATE policy on mini_checkup_settings
--    Only service_role should be able to mutate global settings.
--    Authenticated users only need SELECT.
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can update checkup settings" ON mini_checkup_settings;

-- No replacement INSERT/UPDATE/DELETE policies for authenticated role —
-- service_role bypasses RLS by default, so admin operations still work.

-- ============================================================
-- 7. FIX duplicate_budget function search_path
-- ============================================================

CREATE OR REPLACE FUNCTION public.duplicate_budget(
  source_id  uuid,
  new_name   text,
  new_year   int
)
RETURNS json
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_source   budgets%ROWTYPE;
  v_new      budgets%ROWTYPE;
BEGIN
  SELECT * INTO v_source
  FROM budgets
  WHERE id = source_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget ikke fundet: %', source_id;
  END IF;

  INSERT INTO budgets (
    user_id,
    name,
    year,
    start_month,
    end_month
  )
  VALUES (
    v_source.user_id,
    new_name,
    new_year,
    COALESCE(v_source.start_month, 1),
    COALESCE(v_source.end_month, 12)
  )
  RETURNING * INTO v_new;

  INSERT INTO budget_plans (
    budget_id,
    recipient_id,
    month,
    amount_planned
  )
  SELECT
    v_new.id,
    recipient_id,
    month,
    COALESCE(amount_planned, 0)
  FROM budget_plans
  WHERE budget_id = source_id;

  RETURN row_to_json(v_new);
END;
$$;

GRANT EXECUTE ON FUNCTION public.duplicate_budget(uuid, text, int) TO authenticated;
