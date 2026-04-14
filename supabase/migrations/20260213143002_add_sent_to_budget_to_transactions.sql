/*
  # Add sent_to_budget flag to transactions

  1. Changes
    - Add `sent_to_budget` (boolean) column to transactions table
    - Defaults to false for new transactions
    - Add `sent_at` (timestamp) column to track when it was sent
  
  2. Purpose
    - Track which transactions have been synchronized to the budget
    - Allow users to see which transactions are still pending
    - Enable separation of sent vs unsent transactions in the UI
*/

-- Add sent_to_budget column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'sent_to_budget'
  ) THEN
    ALTER TABLE transactions ADD COLUMN sent_to_budget boolean DEFAULT false;
  END IF;
END $$;

-- Add sent_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'sent_at'
  ) THEN
    ALTER TABLE transactions ADD COLUMN sent_at timestamptz;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_sent_to_budget ON transactions(sent_to_budget);
CREATE INDEX IF NOT EXISTS idx_transactions_budget_sent ON transactions(budget_id, sent_to_budget);