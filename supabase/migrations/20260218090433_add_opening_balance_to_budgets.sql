/*
  # Add opening_balance to budgets

  ## Summary
  Adds an `opening_balance` column to the `budgets` table, allowing users to
  specify the starting balance on their budget account at the beginning of the
  budget period.

  ## Changes
  - `budgets.opening_balance` (numeric, default 0) – the account balance at
    the start of the budget period. This is added on top of the calculated
    income/expense difference to show the true available balance.

  ## Notes
  - Existing budgets default to 0 (no opening balance)
  - The value can be positive (savings buffer) or negative (existing debt)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'opening_balance'
  ) THEN
    ALTER TABLE budgets ADD COLUMN opening_balance numeric NOT NULL DEFAULT 0;
  END IF;
END $$;
