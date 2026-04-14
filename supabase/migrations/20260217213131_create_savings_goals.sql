/*
  # Create savings_goals table

  ## Summary
  Adds a savings goals feature so users can set financial targets they want to save towards.

  ## New Tables
  - `savings_goals`
    - `id` (uuid, primary key)
    - `name` (text) - Goal name, e.g. "Ny bil", "Sommerferie"
    - `description` (text, nullable) - Optional description of the goal
    - `target_amount` (numeric) - The total amount to save towards
    - `current_amount` (numeric) - How much has been saved so far
    - `monthly_contribution` (numeric, nullable) - Optional: how much is set aside monthly
    - `emoji` (text, nullable) - Optional emoji for visual flair
    - `color` (text, nullable) - Accent color for the goal card
    - `completed` (boolean) - Whether the goal has been reached
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Public read/insert/update/delete policies (single-user app, no auth)
*/

CREATE TABLE IF NOT EXISTS savings_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  target_amount numeric NOT NULL DEFAULT 0,
  current_amount numeric NOT NULL DEFAULT 0,
  monthly_contribution numeric,
  emoji text,
  color text DEFAULT '#2ED3A7',
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select savings_goals"
  ON savings_goals FOR SELECT
  USING (true);

CREATE POLICY "Allow insert savings_goals"
  ON savings_goals FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update savings_goals"
  ON savings_goals FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete savings_goals"
  ON savings_goals FOR DELETE
  USING (true);
