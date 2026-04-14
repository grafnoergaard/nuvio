/*
  # Fix RLS auth() initialization plan for standard_data and user_precision_commitment

  ## Summary
  Replaces bare `auth.jwt()` and `auth.uid()` calls with `(select auth.jwt())`
  and `(select auth.uid())` in RLS policies for:
  - `public.standard_data_entries`
  - `public.standard_data_versions`
  - `public.user_precision_commitment`

  This ensures auth functions are evaluated once per statement rather than
  once per row, improving query performance at scale.

  ## Security
  No change in access control logic — only evaluation strategy is optimized.
*/

-- standard_data_entries
DROP POLICY IF EXISTS "Admins can delete standard_data_entries" ON public.standard_data_entries;
DROP POLICY IF EXISTS "Admins can insert standard_data_entries" ON public.standard_data_entries;
DROP POLICY IF EXISTS "Admins can update standard_data_entries" ON public.standard_data_entries;

CREATE POLICY "Admins can delete standard_data_entries"
  ON public.standard_data_entries FOR DELETE
  TO authenticated
  USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true);

CREATE POLICY "Admins can insert standard_data_entries"
  ON public.standard_data_entries FOR INSERT
  TO authenticated
  WITH CHECK (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true);

CREATE POLICY "Admins can update standard_data_entries"
  ON public.standard_data_entries FOR UPDATE
  TO authenticated
  USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true)
  WITH CHECK (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true);

-- standard_data_versions
DROP POLICY IF EXISTS "Admins can delete standard_data_versions" ON public.standard_data_versions;
DROP POLICY IF EXISTS "Admins can insert standard_data_versions" ON public.standard_data_versions;
DROP POLICY IF EXISTS "Admins can update standard_data_versions" ON public.standard_data_versions;

CREATE POLICY "Admins can delete standard_data_versions"
  ON public.standard_data_versions FOR DELETE
  TO authenticated
  USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true);

CREATE POLICY "Admins can insert standard_data_versions"
  ON public.standard_data_versions FOR INSERT
  TO authenticated
  WITH CHECK (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true);

CREATE POLICY "Admins can update standard_data_versions"
  ON public.standard_data_versions FOR UPDATE
  TO authenticated
  USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true)
  WITH CHECK (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true);

-- user_precision_commitment
DROP POLICY IF EXISTS "Users can insert own commitment" ON public.user_precision_commitment;
DROP POLICY IF EXISTS "Users can read own commitment" ON public.user_precision_commitment;
DROP POLICY IF EXISTS "Users can update own commitment" ON public.user_precision_commitment;

CREATE POLICY "Users can insert own commitment"
  ON public.user_precision_commitment FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can read own commitment"
  ON public.user_precision_commitment FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own commitment"
  ON public.user_precision_commitment FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
