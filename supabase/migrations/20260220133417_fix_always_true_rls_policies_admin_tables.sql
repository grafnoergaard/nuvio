
/*
  # Fix always-true RLS policies on admin config tables

  Tables advisory_engine_settings, nav_groups, nav_items, nav_plan_sub_groups,
  and nav_plan_sub_items are CMS/admin configuration tables. Write operations
  (INSERT, UPDATE, DELETE) should be restricted to admin users only.
  Read access remains open to all authenticated users.

  Changes per table:
  - DROP existing always-true INSERT/UPDATE/DELETE policies
  - Recreate with admin-only check using app_metadata role = 'admin'
*/

-- ============================================================
-- advisory_engine_settings
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert advisory engine settings" ON public.advisory_engine_settings;
DROP POLICY IF EXISTS "Authenticated users can update advisory engine settings" ON public.advisory_engine_settings;

CREATE POLICY "Admins can insert advisory engine settings"
  ON public.advisory_engine_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
  );

CREATE POLICY "Admins can update advisory engine settings"
  ON public.advisory_engine_settings
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
  )
  WITH CHECK (
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
  );

-- ============================================================
-- nav_groups
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can delete nav_groups" ON public.nav_groups;
DROP POLICY IF EXISTS "Authenticated users can insert nav_groups" ON public.nav_groups;
DROP POLICY IF EXISTS "Authenticated users can update nav_groups" ON public.nav_groups;

CREATE POLICY "Admins can insert nav_groups"
  ON public.nav_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
  );

CREATE POLICY "Admins can update nav_groups"
  ON public.nav_groups
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
  )
  WITH CHECK (
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
  );

CREATE POLICY "Admins can delete nav_groups"
  ON public.nav_groups
  FOR DELETE
  TO authenticated
  USING (
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
  );

-- ============================================================
-- nav_items
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can delete nav_items" ON public.nav_items;
DROP POLICY IF EXISTS "Authenticated users can insert nav_items" ON public.nav_items;
DROP POLICY IF EXISTS "Authenticated users can update nav_items" ON public.nav_items;

CREATE POLICY "Admins can insert nav_items"
  ON public.nav_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
  );

CREATE POLICY "Admins can update nav_items"
  ON public.nav_items
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
  )
  WITH CHECK (
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
  );

CREATE POLICY "Admins can delete nav_items"
  ON public.nav_items
  FOR DELETE
  TO authenticated
  USING (
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
  );

-- ============================================================
-- nav_plan_sub_groups
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can delete nav_plan_sub_groups" ON public.nav_plan_sub_groups;
DROP POLICY IF EXISTS "Authenticated users can insert nav_plan_sub_groups" ON public.nav_plan_sub_groups;
DROP POLICY IF EXISTS "Authenticated users can update nav_plan_sub_groups" ON public.nav_plan_sub_groups;

CREATE POLICY "Admins can insert nav_plan_sub_groups"
  ON public.nav_plan_sub_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
  );

CREATE POLICY "Admins can update nav_plan_sub_groups"
  ON public.nav_plan_sub_groups
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
  )
  WITH CHECK (
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
  );

CREATE POLICY "Admins can delete nav_plan_sub_groups"
  ON public.nav_plan_sub_groups
  FOR DELETE
  TO authenticated
  USING (
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
  );

-- ============================================================
-- nav_plan_sub_items
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can delete nav_plan_sub_items" ON public.nav_plan_sub_items;
DROP POLICY IF EXISTS "Authenticated users can insert nav_plan_sub_items" ON public.nav_plan_sub_items;
DROP POLICY IF EXISTS "Authenticated users can update nav_plan_sub_items" ON public.nav_plan_sub_items;

CREATE POLICY "Admins can insert nav_plan_sub_items"
  ON public.nav_plan_sub_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
  );

CREATE POLICY "Admins can update nav_plan_sub_items"
  ON public.nav_plan_sub_items
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
  )
  WITH CHECK (
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
  );

CREATE POLICY "Admins can delete nav_plan_sub_items"
  ON public.nav_plan_sub_items
  FOR DELETE
  TO authenticated
  USING (
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
  );
