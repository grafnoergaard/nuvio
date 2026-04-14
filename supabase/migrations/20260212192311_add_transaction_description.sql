/*
  # Add Description Field to Transactions

  1. Changes
    - Add `description` column to `transactions` table (NOT NULL)
    - Backfill existing rows with empty string
    - Add index on description for faster text searches

  2. Notes
    - The description field stores the transaction text/merchant name
    - This is a required field for all transactions
    - Existing data is preserved with empty string fallback
*/

-- Add description column (nullable first to allow backfill)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'description'
  ) THEN
    ALTER TABLE transactions ADD COLUMN description text;
  END IF;
END $$;

-- Backfill existing transactions with empty string
UPDATE transactions SET description = '' WHERE description IS NULL;

-- Now make it NOT NULL
ALTER TABLE transactions ALTER COLUMN description SET NOT NULL;

-- Add index for text searches
CREATE INDEX IF NOT EXISTS idx_transactions_description ON transactions(description);