/*
  # Fix ui_strings RLS policies to use is_admin instead of role = 'admin'

  ## Problem
  The existing UPDATE/INSERT/DELETE policies check for:
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'

  But users actually have:
    app_metadata.is_admin = true

  This caused all admin writes to ui_strings to silently fail.

  ## Fix
  Replace the role check with is_admin = true on all write policies.
*/

DROP POLICY IF EXISTS "Admins can update ui_strings" ON ui_strings;
DROP POLICY IF EXISTS "Admins can insert ui_strings" ON ui_strings;
DROP POLICY IF EXISTS "Admins can delete ui_strings" ON ui_strings;

CREATE POLICY "Admins can update ui_strings"
  ON ui_strings FOR UPDATE
  TO authenticated
  USING (((auth.jwt() -> 'app_metadata') ->> 'is_admin')::boolean = true)
  WITH CHECK (((auth.jwt() -> 'app_metadata') ->> 'is_admin')::boolean = true);

CREATE POLICY "Admins can insert ui_strings"
  ON ui_strings FOR INSERT
  TO authenticated
  WITH CHECK (((auth.jwt() -> 'app_metadata') ->> 'is_admin')::boolean = true);

CREATE POLICY "Admins can delete ui_strings"
  ON ui_strings FOR DELETE
  TO authenticated
  USING (((auth.jwt() -> 'app_metadata') ->> 'is_admin')::boolean = true);
