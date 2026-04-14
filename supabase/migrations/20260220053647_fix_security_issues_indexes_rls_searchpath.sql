/*
  # Fix security issues

  1. Add missing FK indexes
     - `mini_checkup_user_state.user_id`
     - `transactions.category_group_id`

  2. Fix RLS policies on `ui_strings` to use `(select auth.jwt())` instead of `auth.jwt()`
     to avoid per-row re-evaluation

  3. Drop unused indexes to reduce write overhead
     - `idx_mini_checkup_settings_updated_by`
     - `idx_recipient_rules_recipient_id`
     - `idx_ui_strings_key`

  4. Fix mutable search_path on `update_ui_strings_updated_at` function
*/

-- 1. Add missing FK indexes
CREATE INDEX IF NOT EXISTS idx_mini_checkup_user_state_user_id
  ON public.mini_checkup_user_state (user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_category_group_id
  ON public.transactions (category_group_id);

-- 2. Fix ui_strings RLS policies
DROP POLICY IF EXISTS "Admins can delete ui_strings" ON public.ui_strings;
DROP POLICY IF EXISTS "Admins can insert ui_strings" ON public.ui_strings;
DROP POLICY IF EXISTS "Admins can update ui_strings" ON public.ui_strings;

CREATE POLICY "Admins can delete ui_strings"
  ON public.ui_strings
  FOR DELETE
  TO authenticated
  USING (
    (((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text
  );

CREATE POLICY "Admins can insert ui_strings"
  ON public.ui_strings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text
  );

CREATE POLICY "Admins can update ui_strings"
  ON public.ui_strings
  FOR UPDATE
  TO authenticated
  USING (
    (((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text
  )
  WITH CHECK (
    (((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text
  );

-- 3. Drop unused indexes
DROP INDEX IF EXISTS public.idx_mini_checkup_settings_updated_by;
DROP INDEX IF EXISTS public.idx_recipient_rules_recipient_id;
DROP INDEX IF EXISTS public.idx_ui_strings_key;

-- 4. Fix mutable search_path on trigger function
CREATE OR REPLACE FUNCTION public.update_ui_strings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
