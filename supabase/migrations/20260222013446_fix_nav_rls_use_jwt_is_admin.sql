/*
  # Fix nav admin RLS policies to use auth.jwt() instead of auth.users subquery

  ## Problem
  Policies using subqueries to auth.users table fail when called via anon key,
  because the anon role cannot access auth.users. The result is NULL which never
  equals true, silently blocking all admin write operations.

  ## Fix
  Use auth.jwt() -> 'app_metadata' ->> 'is_admin' = 'true' which reads directly
  from the JWT token without needing to query auth.users.
*/

-- nav_groups
DROP POLICY IF EXISTS "Admins can insert nav_groups" ON nav_groups;
DROP POLICY IF EXISTS "Admins can update nav_groups" ON nav_groups;
DROP POLICY IF EXISTS "Admins can delete nav_groups" ON nav_groups;

CREATE POLICY "Admins can insert nav_groups"
  ON nav_groups FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  );

CREATE POLICY "Admins can update nav_groups"
  ON nav_groups FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  );

CREATE POLICY "Admins can delete nav_groups"
  ON nav_groups FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  );

-- nav_items
DROP POLICY IF EXISTS "Admins can insert nav_items" ON nav_items;
DROP POLICY IF EXISTS "Admins can update nav_items" ON nav_items;
DROP POLICY IF EXISTS "Admins can delete nav_items" ON nav_items;

CREATE POLICY "Admins can insert nav_items"
  ON nav_items FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  );

CREATE POLICY "Admins can update nav_items"
  ON nav_items FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  );

CREATE POLICY "Admins can delete nav_items"
  ON nav_items FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  );

-- nav_plan_sub_groups
DROP POLICY IF EXISTS "Admins can insert nav_plan_sub_groups" ON nav_plan_sub_groups;
DROP POLICY IF EXISTS "Admins can update nav_plan_sub_groups" ON nav_plan_sub_groups;
DROP POLICY IF EXISTS "Admins can delete nav_plan_sub_groups" ON nav_plan_sub_groups;

CREATE POLICY "Admins can insert nav_plan_sub_groups"
  ON nav_plan_sub_groups FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  );

CREATE POLICY "Admins can update nav_plan_sub_groups"
  ON nav_plan_sub_groups FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  );

CREATE POLICY "Admins can delete nav_plan_sub_groups"
  ON nav_plan_sub_groups FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  );

-- nav_plan_sub_items
DROP POLICY IF EXISTS "Admins can insert nav_plan_sub_items" ON nav_plan_sub_items;
DROP POLICY IF EXISTS "Admins can update nav_plan_sub_items" ON nav_plan_sub_items;
DROP POLICY IF EXISTS "Admins can delete nav_plan_sub_items" ON nav_plan_sub_items;

CREATE POLICY "Admins can insert nav_plan_sub_items"
  ON nav_plan_sub_items FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  );

CREATE POLICY "Admins can update nav_plan_sub_items"
  ON nav_plan_sub_items FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  );

CREATE POLICY "Admins can delete nav_plan_sub_items"
  ON nav_plan_sub_items FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  );
