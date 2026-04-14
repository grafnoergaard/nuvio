/*
  # Add household income tracking with precision flag

  ## Summary
  Adds support for tracking household income with a flag indicating whether the value is precise or estimated.

  ## Changes

  ### Modified Tables
  - `household`
    - Added `household_income` (numeric) — the total household income (either precise or estimated midpoint)
    - Added `household_income_is_precise` (boolean) — true if user entered precise amount, false if selected interval

  ## Implementation Notes
  - When user enters precise amount: `household_income_is_precise = true`
  - When user selects interval: `household_income_is_precise = false` and `household_income` = midpoint of interval
  - Default values: `household_income = 0`, `household_income_is_precise = false`

  ## Security
  - No RLS changes needed (inherits from existing household policies)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'household'
    AND column_name = 'household_income'
  ) THEN
    ALTER TABLE household ADD COLUMN household_income numeric DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'household'
    AND column_name = 'household_income_is_precise'
  ) THEN
    ALTER TABLE household ADD COLUMN household_income_is_precise boolean DEFAULT false NOT NULL;
  END IF;
END $$;
