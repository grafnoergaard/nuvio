/*
  # Fix RLS auth() initialization plan for nav tables

  ## Summary
  Replaces bare `auth.jwt()` calls in RLS policies for nav_groups, nav_items,
  nav_plan_sub_groups, and nav_plan_sub_items with `(select auth.jwt())`.
  This ensures the JWT is evaluated once per statement rather than once per row,
  significantly improving query performance at scale.

  ## Affected Tables
  - `public.nav_groups` — delete, insert, update admin policies
  - `public.nav_items` — delete, insert, update admin policies
  - `public.nav_plan_sub_groups` — delete, insert, update admin policies
  - `public.nav_plan_sub_items` — delete, insert, update admin policies

  ## Security
  No change in access control logic — only evaluation strategy is optimized.
*/

-- nav_groups
DROP POLICY IF EXISTS "Admins can delete nav_groups" ON public.nav_groups;
DROP POLICY IF EXISTS "Admins can insert nav_groups" ON public.nav_groups;
DROP POLICY IF EXISTS "Admins can update nav_groups" ON public.nav_groups;

CREATE POLICY "Admins can delete nav_groups"
  ON public.nav_groups FOR DELETE
  TO authenticated
  USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true);

CREATE POLICY "Admins can insert nav_groups"
  ON public.nav_groups FOR INSERT
  TO authenticated
  WITH CHECK (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true);

CREATE POLICY "Admins can update nav_groups"
  ON public.nav_groups FOR UPDATE
  TO authenticated
  USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true)
  WITH CHECK (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true);

-- nav_items
DROP POLICY IF EXISTS "Admins can delete nav_items" ON public.nav_items;
DROP POLICY IF EXISTS "Admins can insert nav_items" ON public.nav_items;
DROP POLICY IF EXISTS "Admins can update nav_items" ON public.nav_items;

CREATE POLICY "Admins can delete nav_items"
  ON public.nav_items FOR DELETE
  TO authenticated
  USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true);

CREATE POLICY "Admins can insert nav_items"
  ON public.nav_items FOR INSERT
  TO authenticated
  WITH CHECK (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true);

CREATE POLICY "Admins can update nav_items"
  ON public.nav_items FOR UPDATE
  TO authenticated
  USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true)
  WITH CHECK (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true);

-- nav_plan_sub_groups
DROP POLICY IF EXISTS "Admins can delete nav_plan_sub_groups" ON public.nav_plan_sub_groups;
DROP POLICY IF EXISTS "Admins can insert nav_plan_sub_groups" ON public.nav_plan_sub_groups;
DROP POLICY IF EXISTS "Admins can update nav_plan_sub_groups" ON public.nav_plan_sub_groups;

CREATE POLICY "Admins can delete nav_plan_sub_groups"
  ON public.nav_plan_sub_groups FOR DELETE
  TO authenticated
  USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true);

CREATE POLICY "Admins can insert nav_plan_sub_groups"
  ON public.nav_plan_sub_groups FOR INSERT
  TO authenticated
  WITH CHECK (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true);

CREATE POLICY "Admins can update nav_plan_sub_groups"
  ON public.nav_plan_sub_groups FOR UPDATE
  TO authenticated
  USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true)
  WITH CHECK (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true);

-- nav_plan_sub_items
DROP POLICY IF EXISTS "Admins can delete nav_plan_sub_items" ON public.nav_plan_sub_items;
DROP POLICY IF EXISTS "Admins can insert nav_plan_sub_items" ON public.nav_plan_sub_items;
DROP POLICY IF EXISTS "Admins can update nav_plan_sub_items" ON public.nav_plan_sub_items;

CREATE POLICY "Admins can delete nav_plan_sub_items"
  ON public.nav_plan_sub_items FOR DELETE
  TO authenticated
  USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true);

CREATE POLICY "Admins can insert nav_plan_sub_items"
  ON public.nav_plan_sub_items FOR INSERT
  TO authenticated
  WITH CHECK (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true);

CREATE POLICY "Admins can update nav_plan_sub_items"
  ON public.nav_plan_sub_items FOR UPDATE
  TO authenticated
  USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true)
  WITH CHECK (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'is_admin'::text))::boolean = true);
