/*
  # Add Merchant Disambiguation Support

  1. Changes to transactions table
    - Add `recipient_name` (text, nullable) - Custom name for merchant/recipient, overrides description
  
  2. New Tables
    - `merchant_rules`
      - `id` (uuid, primary key)
      - `budget_id` (uuid, nullable) - If null, rule applies globally
      - `text_match` (text) - Exact match for transaction description
      - `amount_match` (numeric, nullable) - Optional amount to match
      - `recipient_name` (text) - The recipient name to apply
      - `created_at` (timestamp)
  
  3. Security
    - Enable RLS on `merchant_rules` table
    - Add policies for authenticated users
*/

-- Add recipient_name to transactions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'recipient_name'
  ) THEN
    ALTER TABLE transactions ADD COLUMN recipient_name text;
  END IF;
END $$;

-- Create merchant_rules table
CREATE TABLE IF NOT EXISTS merchant_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid REFERENCES budgets(id) ON DELETE CASCADE,
  text_match text NOT NULL,
  amount_match numeric,
  recipient_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE merchant_rules ENABLE ROW LEVEL SECURITY;

-- Policies for merchant_rules
CREATE POLICY "Anyone can read merchant rules"
  ON merchant_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can insert merchant rules"
  ON merchant_rules FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update merchant rules"
  ON merchant_rules FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete merchant rules"
  ON merchant_rules FOR DELETE
  TO authenticated
  USING (true);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_merchant_rules_budget_text 
  ON merchant_rules(budget_id, text_match);

CREATE INDEX IF NOT EXISTS idx_merchant_rules_text 
  ON merchant_rules(text_match);