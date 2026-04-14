/*
  # Create household table

  ## Summary
  Stores a single household configuration for the application.

  ## New Tables

  ### `household`
  - `id` (uuid, primary key) — single row, we use a fixed well-known id
  - `adult_count` (integer) — number of adults in the household
  - `child_count` (integer) — number of home-living children
  - `members` (jsonb) — array of { name: string, type: 'adult'|'child', monthly_net_salary: number|null }
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Public read/write for MVP (no auth required, single household)
*/

CREATE TABLE IF NOT EXISTS household (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adult_count integer NOT NULL DEFAULT 1,
  child_count integer NOT NULL DEFAULT 0,
  members jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE household ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read household"
  ON household FOR SELECT
  USING (true);

CREATE POLICY "Public can insert household"
  ON household FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can update household"
  ON household FOR UPDATE
  USING (true)
  WITH CHECK (true);
