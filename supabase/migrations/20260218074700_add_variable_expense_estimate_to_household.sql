/*
  # Add variable_expense_estimate to household

  ## Summary
  Adds a column to store the monthly variable expense estimate calculated by the
  variable expense wizard. This value is set by the user when they confirm the
  estimate on the result screen.

  ## Changes
  - `household` table: new nullable numeric column `variable_expense_estimate`
    Stores the monthly variable spending estimate in DKK. NULL means not yet set.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'household' AND column_name = 'variable_expense_estimate'
  ) THEN
    ALTER TABLE household ADD COLUMN variable_expense_estimate numeric DEFAULT NULL;
  END IF;
END $$;
