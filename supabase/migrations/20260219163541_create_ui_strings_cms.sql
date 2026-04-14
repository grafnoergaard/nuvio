/*
  # Create UI Strings CMS Table

  ## Purpose
  Enables backend-driven text management for the entire app.
  Admin users can edit all UI text without redeploying code.

  ## New Tables
  - `ui_strings`
    - `id` (uuid, primary key)
    - `key` (text, unique) - dot-notation key, e.g. "anbefalinger.title"
    - `value` (text) - the display text
    - `description` (text, nullable) - internal note about where this text appears
    - `created_at` / `updated_at` (timestamps)

  ## Security
  - RLS enabled
  - Anyone (authenticated) can SELECT (read) strings
  - Only admins (app_metadata.role = 'admin') can INSERT/UPDATE/DELETE

  ## Notes
  - Admin role is set via Supabase Dashboard: Authentication > Users > Edit user > app_metadata: {"role": "admin"}
  - Fallback to hardcoded text happens in the React component if key is missing
*/

CREATE TABLE IF NOT EXISTS ui_strings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ui_strings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read ui_strings"
  ON ui_strings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert ui_strings"
  ON ui_strings FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can update ui_strings"
  ON ui_strings FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can delete ui_strings"
  ON ui_strings FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE OR REPLACE FUNCTION update_ui_strings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ui_strings_updated_at
  BEFORE UPDATE ON ui_strings
  FOR EACH ROW EXECUTE FUNCTION update_ui_strings_updated_at();

CREATE INDEX IF NOT EXISTS idx_ui_strings_key ON ui_strings(key);
