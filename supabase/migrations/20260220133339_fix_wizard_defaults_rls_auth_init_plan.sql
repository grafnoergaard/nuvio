
/*
  # Fix wizard_defaults RLS auth initialization plan

  Replace inline auth.uid() calls with (select auth.uid()) in wizard_defaults
  policies to avoid per-row re-evaluation, improving query performance.

  Changes:
  - Drop and recreate "Admins can insert wizard defaults"
  - Drop and recreate "Admins can update wizard defaults"
*/

DROP POLICY IF EXISTS "Admins can insert wizard defaults" ON public.wizard_defaults;
DROP POLICY IF EXISTS "Admins can update wizard defaults" ON public.wizard_defaults;

CREATE POLICY "Admins can insert wizard defaults"
  ON public.wizard_defaults
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
    ) OR (
      (SELECT raw_user_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
    ) OR (
      NOT EXISTS (SELECT 1 FROM public.wizard_defaults LIMIT 1)
    )
  );

CREATE POLICY "Admins can update wizard defaults"
  ON public.wizard_defaults
  FOR UPDATE
  TO authenticated
  USING (
    (
      (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
    ) OR (
      (SELECT raw_user_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
    )
  )
  WITH CHECK (
    (
      (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
    ) OR (
      (SELECT raw_user_meta_data ->> 'role' FROM auth.users WHERE id = (SELECT auth.uid())) = 'admin'
    )
  );
