/*
  # Create Flow Savings Tables

  ## Overview
  Tracks weekly savings accumulated through Nuvio Flow (variable expense budget carry-over).
  Separate from savings goals — this is the automatic "leftover money" tracking system.

  ## New Tables

  ### `flow_savings_entries`
  Each row represents one week's carry-over that was saved (positive only).
  - `id` — UUID primary key
  - `user_id` — owner
  - `year`, `month`, `week_number` — identifies which week
  - `amount` — the positive carry-over saved that week (>= 0)
  - `budget_amount` — what the weekly budget was
  - `total_spent` — what was actually spent
  - `created_at`

  ### `flow_savings_totals`
  One row per user — the running total and lifetime total.
  - `user_id` — unique, primary owner
  - `current_balance` — current accumulated balance (resets on "Start forfra")
  - `lifetime_total` — never resets; always grows
  - `week_count` — how many weeks had positive savings
  - `reset_count` — how many times user has reset
  - `last_reset_at` — when they last reset
  - `updated_at`

  ## Security
  - RLS enabled on both tables
  - Users can only access their own rows
*/

CREATE TABLE IF NOT EXISTS flow_savings_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  week_number integer NOT NULL CHECK (week_number >= 1),
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  budget_amount numeric NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, year, month, week_number)
);

ALTER TABLE flow_savings_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own flow savings entries"
  ON flow_savings_entries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flow savings entries"
  ON flow_savings_entries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own flow savings entries"
  ON flow_savings_entries FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own flow savings entries"
  ON flow_savings_entries FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS flow_savings_entries_user_id_idx ON flow_savings_entries(user_id);
CREATE INDEX IF NOT EXISTS flow_savings_entries_user_year_month_idx ON flow_savings_entries(user_id, year, month);

CREATE TABLE IF NOT EXISTS flow_savings_totals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  current_balance numeric NOT NULL DEFAULT 0,
  lifetime_total numeric NOT NULL DEFAULT 0,
  week_count integer NOT NULL DEFAULT 0,
  reset_count integer NOT NULL DEFAULT 0,
  last_reset_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE flow_savings_totals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own flow savings totals"
  ON flow_savings_totals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flow savings totals"
  ON flow_savings_totals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own flow savings totals"
  ON flow_savings_totals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS flow_savings_totals_user_id_idx ON flow_savings_totals(user_id);
