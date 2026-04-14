/*
  # Fix nav admin RLS policies to use is_admin flag

  ## Problem
  All admin write policies on nav tables check `raw_app_meta_data ->> 'role' = 'admin'`,
  but the admin user has `is_admin: true` in raw_app_meta_data — not a 'role' key.
  This caused all INSERT/UPDATE/DELETE operations to silently fail for admins.

  ## Fix
  Replace the role check with `(raw_app_meta_data ->> 'is_admin')::boolean = true`
  on all four nav tables: nav_groups, nav_items, nav_plan_sub_groups, nav_plan_sub_items.
*/

-- nav_groups
DROP POLICY IF EXISTS "Admins can insert nav_groups" ON nav_groups;
DROP POLICY IF EXISTS "Admins can update nav_groups" ON nav_groups;
DROP POLICY IF EXISTS "Admins can delete nav_groups" ON nav_groups;

CREATE POLICY "Admins can insert nav_groups"
  ON nav_groups FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT (users.raw_app_meta_data ->> 'is_admin')::boolean FROM auth.users WHERE users.id = auth.uid()) = true
  );

CREATE POLICY "Admins can update nav_groups"
  ON nav_groups FOR UPDATE
  TO authenticated
  USING (
    (SELECT (users.raw_app_meta_data ->> 'is_admin')::boolean FROM auth.users WHERE users.id = auth.uid()) = true
  )
  WITH CHECK (
    (SELECT (users.raw_app_meta_data ->> 'is_admin')::boolean FROM auth.users WHERE users.id = auth.uid()) = true
  );

CREATE POLICY "Admins can delete nav_groups"
  ON nav_groups FOR DELETE
  TO authenticated
  USING (
    (SELECT (users.raw_app_meta_data ->> 'is_admin')::boolean FROM auth.users WHERE users.id = auth.uid()) = true
  );

-- nav_items
DROP POLICY IF EXISTS "Admins can insert nav_items" ON nav_items;
DROP POLICY IF EXISTS "Admins can update nav_items" ON nav_items;
DROP POLICY IF EXISTS "Admins can delete nav_items" ON nav_items;

CREATE POLICY "Admins can insert nav_items"
  ON nav_items FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT (users.raw_app_meta_data ->> 'is_admin')::boolean FROM auth.users WHERE users.id = auth.uid()) = true
  );

CREATE POLICY "Admins can update nav_items"
  ON nav_items FOR UPDATE
  TO authenticated
  USING (
    (SELECT (users.raw_app_meta_data ->> 'is_admin')::boolean FROM auth.users WHERE users.id = auth.uid()) = true
  )
  WITH CHECK (
    (SELECT (users.raw_app_meta_data ->> 'is_admin')::boolean FROM auth.users WHERE users.id = auth.uid()) = true
  );

CREATE POLICY "Admins can delete nav_items"
  ON nav_items FOR DELETE
  TO authenticated
  USING (
    (SELECT (users.raw_app_meta_data ->> 'is_admin')::boolean FROM auth.users WHERE users.id = auth.uid()) = true
  );

-- nav_plan_sub_groups
DROP POLICY IF EXISTS "Admins can insert nav_plan_sub_groups" ON nav_plan_sub_groups;
DROP POLICY IF EXISTS "Admins can update nav_plan_sub_groups" ON nav_plan_sub_groups;
DROP POLICY IF EXISTS "Admins can delete nav_plan_sub_groups" ON nav_plan_sub_groups;

CREATE POLICY "Admins can insert nav_plan_sub_groups"
  ON nav_plan_sub_groups FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT (users.raw_app_meta_data ->> 'is_admin')::boolean FROM auth.users WHERE users.id = auth.uid()) = true
  );

CREATE POLICY "Admins can update nav_plan_sub_groups"
  ON nav_plan_sub_groups FOR UPDATE
  TO authenticated
  USING (
    (SELECT (users.raw_app_meta_data ->> 'is_admin')::boolean FROM auth.users WHERE users.id = auth.uid()) = true
  )
  WITH CHECK (
    (SELECT (users.raw_app_meta_data ->> 'is_admin')::boolean FROM auth.users WHERE users.id = auth.uid()) = true
  );

CREATE POLICY "Admins can delete nav_plan_sub_groups"
  ON nav_plan_sub_groups FOR DELETE
  TO authenticated
  USING (
    (SELECT (users.raw_app_meta_data ->> 'is_admin')::boolean FROM auth.users WHERE users.id = auth.uid()) = true
  );

-- nav_plan_sub_items
DROP POLICY IF EXISTS "Admins can insert nav_plan_sub_items" ON nav_plan_sub_items;
DROP POLICY IF EXISTS "Admins can update nav_plan_sub_items" ON nav_plan_sub_items;
DROP POLICY IF EXISTS "Admins can delete nav_plan_sub_items" ON nav_plan_sub_items;

CREATE POLICY "Admins can insert nav_plan_sub_items"
  ON nav_plan_sub_items FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT (users.raw_app_meta_data ->> 'is_admin')::boolean FROM auth.users WHERE users.id = auth.uid()) = true
  );

CREATE POLICY "Admins can update nav_plan_sub_items"
  ON nav_plan_sub_items FOR UPDATE
  TO authenticated
  USING (
    (SELECT (users.raw_app_meta_data ->> 'is_admin')::boolean FROM auth.users WHERE users.id = auth.uid()) = true
  )
  WITH CHECK (
    (SELECT (users.raw_app_meta_data ->> 'is_admin')::boolean FROM auth.users WHERE users.id = auth.uid()) = true
  );

CREATE POLICY "Admins can delete nav_plan_sub_items"
  ON nav_plan_sub_items FOR DELETE
  TO authenticated
  USING (
    (SELECT (users.raw_app_meta_data ->> 'is_admin')::boolean FROM auth.users WHERE users.id = auth.uid()) = true
  );
