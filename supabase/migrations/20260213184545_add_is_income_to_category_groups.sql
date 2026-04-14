/*
  # Add is_income flag to category_groups

  1. Modified Tables
    - `category_groups`
      - Added `is_income` (boolean, default false) to distinguish income groups from expense groups

  2. Data Update
    - Sets is_income = true for groups with names containing 'indkomst' or 'indtægt'

  3. Notes
    - This allows the UI to sort income groups at the top and visually separate them from expenses
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'category_groups' AND column_name = 'is_income'
  ) THEN
    ALTER TABLE category_groups ADD COLUMN is_income boolean DEFAULT false NOT NULL;
  END IF;
END $$;

UPDATE category_groups
SET is_income = true
WHERE lower(name) LIKE '%indkomst%'
   OR lower(name) LIKE '%indtægt%';
