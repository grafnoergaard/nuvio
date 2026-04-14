/*
  # Create user_precision_commitment table

  ## Purpose
  Stores the user's acceptance of the "Nuvios Rådgiverløfte" wizard.
  When a user completes the Why_Wizard, their commitment is recorded here.

  ## New Tables
  - `user_precision_commitment`
    - `id` (uuid, primary key)
    - `user_id` (uuid, references auth.users) — one record per user
    - `accepted_at` (timestamptz) — when the user accepted
    - `version` (text) — wizard version for future iteration tracking
    - `precision_mode` (bool) — whether precision mode is active

  ## Security
  - RLS enabled
  - Users can only read and insert their own commitment
  - Users can update their own commitment (for re-acceptance in future versions)
*/

CREATE TABLE IF NOT EXISTS user_precision_commitment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  version text NOT NULL DEFAULT 'v1',
  precision_mode boolean NOT NULL DEFAULT true,
  UNIQUE(user_id)
);

ALTER TABLE user_precision_commitment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own commitment"
  ON user_precision_commitment FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own commitment"
  ON user_precision_commitment FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own commitment"
  ON user_precision_commitment FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_precision_commitment_user_id
  ON user_precision_commitment(user_id);
