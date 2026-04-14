/*
  # Create investment_settings table

  ## Summary
  Stores the investment wizard answers and computed scenario per user.

  ## New Table: investment_settings
  - id (uuid, primary key)
  - user_id (uuid, references auth.users, unique per user)
  - investing_status: current investment habit
  - has_buffer, no_high_debt, can_afford: foundation checkboxes
  - monthly_amount: monthly investment kr
  - current_amount: existing portfolio value kr
  - time_horizon: short / medium / long
  - market_reaction: sell / wait / invest_more
  - scenario: conservative / base / growth (computed & stored)
  - created_at / updated_at

  ## Security
  - RLS enabled
  - Authenticated users can only read/write their own row
*/

CREATE TABLE IF NOT EXISTS investment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investing_status text NOT NULL DEFAULT 'considering',
  has_buffer boolean NOT NULL DEFAULT false,
  no_high_debt boolean NOT NULL DEFAULT false,
  can_afford boolean NOT NULL DEFAULT false,
  monthly_amount numeric NOT NULL DEFAULT 0,
  current_amount numeric NOT NULL DEFAULT 0,
  time_horizon text NOT NULL DEFAULT 'medium',
  market_reaction text NOT NULL DEFAULT 'wait',
  scenario text NOT NULL DEFAULT 'base',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT investment_settings_user_id_key UNIQUE (user_id)
);

ALTER TABLE investment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own investment settings"
  ON investment_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own investment settings"
  ON investment_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own investment settings"
  ON investment_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own investment settings"
  ON investment_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
