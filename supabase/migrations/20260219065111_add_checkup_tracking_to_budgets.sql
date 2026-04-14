/*
  # Add checkup tracking to budgets

  ## Summary
  Adds two columns to the budgets table that power the mini checkup wizard feature.

  ## New Columns on `budgets`
  - `last_checkup_at` (timestamptz, nullable) — timestamp of the last completed mini checkup
  - `checkup_count` (integer, default 0) — total number of completed checkups for this budget

  ## Notes
  - Both columns are nullable/defaulted so existing budgets are unaffected
  - `last_checkup_at` is NULL for budgets that have never had a checkup
  - The app-shell uses these to decide whether to prompt the user for a new checkup (>60 days)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'last_checkup_at'
  ) THEN
    ALTER TABLE budgets ADD COLUMN last_checkup_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'checkup_count'
  ) THEN
    ALTER TABLE budgets ADD COLUMN checkup_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;
