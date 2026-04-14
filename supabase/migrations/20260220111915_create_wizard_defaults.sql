/*
  # Create wizard_defaults table

  ## Purpose
  Stores configurable default amounts used in onboarding and checkup wizards.
  Allows admins to adjust the pre-filled estimates shown to users without code changes.

  ## Tables

  ### wizard_defaults
  - `id` (uuid, primary key)
  - `type` (text) – 'fixed' or 'variable'
  - `key` (text) – unique identifier for the default (e.g. 'housing_single', 'food_pct')
  - `label` (text) – human-readable label shown in admin UI
  - `value` (numeric) – the default value (amount in kr. or percentage * 100 for splits)
  - `value_couple` (numeric, nullable) – alternate value for couples (only for fixed expenses)
  - `sort_order` (int) – display order in admin UI
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Only authenticated users with admin role can write
  - Authenticated users can read (needed by wizards)
*/

CREATE TABLE IF NOT EXISTS wizard_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('fixed', 'variable')),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  value_couple numeric DEFAULT NULL,
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wizard_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read wizard defaults"
  ON wizard_defaults FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert wizard defaults"
  ON wizard_defaults FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
    OR (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
    OR NOT EXISTS (SELECT 1 FROM wizard_defaults LIMIT 1)
  );

CREATE POLICY "Admins can update wizard defaults"
  ON wizard_defaults FOR UPDATE
  TO authenticated
  USING (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
    OR (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
    OR (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

INSERT INTO wizard_defaults (type, key, label, value, value_couple, sort_order) VALUES
  ('fixed', 'housing',       'Husleje / Boliglån',  8500, 12000, 1),
  ('fixed', 'insurance',     'Forsikringer',         1400,  2200, 2),
  ('fixed', 'utilities',     'El / Vand / Varme',    1200,  1800, 3),
  ('fixed', 'subscriptions', 'Abonnementer',          600,   900, 4),
  ('fixed', 'transport',     'Transport',            1600,  2400, 5),
  ('fixed', 'children',      'Børnerelateret',        1800,  1800, 6),
  ('variable', 'food_pct',      'Mad & dagligvarer (%)',   45, NULL, 1),
  ('variable', 'transport_pct', 'Transport (%)',           20, NULL, 2),
  ('variable', 'cafe_pct',      'Café & takeaway (%)',     10, NULL, 3),
  ('variable', 'leisure_pct',   'Fritid & underholdning (%)', 12, NULL, 4),
  ('variable', 'misc_pct',      'Diverse (%)',              13, NULL, 5)
ON CONFLICT (key) DO NOTHING;
