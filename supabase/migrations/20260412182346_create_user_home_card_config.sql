/*
  # Create user_home_card_config table

  ## Summary
  Per-user home card configuration table that allows individual users to customize
  which cards appear on their home page and in what order.

  ## New Tables
  - `user_home_card_config`
    - `id` (uuid, primary key)
    - `user_id` (uuid, FK to auth.users) — the owning user
    - `card_key` (text) — matches HomeCardKey values
    - `is_visible` (boolean, default true) — user's personal visibility preference
    - `sort_order` (integer, default 10) — user's personal sort order
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Users can only read and write their own rows
  - INSERT: user can only insert rows for themselves
  - SELECT: user can only read their own rows
  - UPDATE: user can only update their own rows
  - DELETE: user can only delete their own rows

  ## Notes
  1. Only 3 card keys are user-configurable: nuvio_score_standalone, budget_status, flow_savings
  2. Admin global config (home_card_config) is still the master — this table stores user overrides
  3. Unique constraint on (user_id, card_key) to prevent duplicates
*/

CREATE TABLE IF NOT EXISTS user_home_card_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_key text NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_home_card_config_unique UNIQUE (user_id, card_key)
);

CREATE INDEX IF NOT EXISTS user_home_card_config_user_id_idx ON user_home_card_config(user_id);

ALTER TABLE user_home_card_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own home card config"
  ON user_home_card_config FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own home card config"
  ON user_home_card_config FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own home card config"
  ON user_home_card_config FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own home card config"
  ON user_home_card_config FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
