/*
  # Add One-Off Flag to Transactions

  1. Changes
    - Add `is_one_off` column to `transactions` table (boolean, default false)
    - This allows marking transactions as one-off expenses to exclude them from recurring analysis

  2. Notes
    - Default value is false for all transactions
    - Existing transactions are automatically set to false (not one-off)
*/

-- Add is_one_off column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'is_one_off'
  ) THEN
    ALTER TABLE transactions ADD COLUMN is_one_off boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add index for filtering by is_one_off
CREATE INDEX IF NOT EXISTS idx_transactions_is_one_off ON transactions(is_one_off);