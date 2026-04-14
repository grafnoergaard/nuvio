/*
  # Create home_card_config table

  ## Summary
  Introduces a new table `home_card_config` to allow admins to control which cards
  are visible on the main Oversigt (home) page — without a code deployment.

  ## New Tables
  - `home_card_config`
    - `id` (uuid, primary key)
    - `card_key` (text, unique) — machine-readable identifier for the card, e.g. "nuvio_score"
    - `label` (text) — human-readable Danish label shown in admin UI
    - `is_visible` (boolean, default true) — whether the card is shown to regular users
    - `sort_order` (integer, default 0) — display order (informational, not enforced in UI yet)
    - `created_at` / `updated_at` (timestamps)

  ## Security
  - RLS enabled
  - Authenticated users can SELECT all rows (needed to render the page)
  - Only admins (app_metadata.is_admin = true OR app_metadata.role = 'admin') can INSERT/UPDATE/DELETE

  ## Seed Data
  All current home page cards are inserted with default is_visible = true.
*/

CREATE TABLE IF NOT EXISTS home_card_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_key text UNIQUE NOT NULL,
  label text NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE home_card_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read home card config"
  ON home_card_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert home card config"
  ON home_card_config FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can update home card config"
  ON home_card_config FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can delete home card config"
  ON home_card_config FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE INDEX IF NOT EXISTS idx_home_card_config_card_key ON home_card_config(card_key);
CREATE INDEX IF NOT EXISTS idx_home_card_config_sort_order ON home_card_config(sort_order);

INSERT INTO home_card_config (card_key, label, is_visible, sort_order) VALUES
  ('onboarding',         'Opsætning (kom i gang)',       true,  10),
  ('nuvio_score',        'Nuvio Score',                  true,  20),
  ('finance_grid',       'Finanskort (mini-grid)',        true,  30),
  ('savings_investment', 'Opsparing & Investering',      true,  40),
  ('overview_checkup',   'Finansielt overblik & Checkup',true,  50),
  ('savings_goals',      'Opsparingsmål (liste)',         true,  60),
  ('next_step',          'Næste skridt',                 true,  70),
  ('consumption_status', 'Forbrugsstatus',               true,  80)
ON CONFLICT (card_key) DO NOTHING;
