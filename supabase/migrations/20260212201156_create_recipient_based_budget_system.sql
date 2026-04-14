/*
  # Create Recipient-Based Budget System

  1. New Tables
    - `recipients`
      - `id` (uuid, primary key)
      - `name` (text, unique) - The recipient/merchant name
      - `default_category_id` (uuid, nullable) - Default category for this recipient
      - `created_at` (timestamp)
    
    - `recipient_rules`
      - `id` (uuid, primary key)
      - `text_match` (text) - Text to match against transaction description
      - `match_type` (text) - 'exact' or 'contains'
      - `amount_match` (numeric, nullable) - Optional amount to match
      - `recipient_id` (uuid) - FK to recipients
      - `priority` (integer) - Higher priority rules are applied first
      - `created_at` (timestamp)
    
    - `budget_plans`
      - `id` (uuid, primary key)
      - `budget_id` (uuid) - FK to budgets
      - `recipient_id` (uuid) - FK to recipients
      - `month` (integer) - 1-12
      - `amount_planned` (numeric) - Planned amount for this recipient in this month
      - `created_at` (timestamp)
      - Unique constraint on (budget_id, recipient_id, month)
  
  2. Changes to transactions table
    - Add `recipient_id` (uuid, nullable) - FK to recipients
  
  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users
  
  4. Indexes
    - Add indexes for better query performance
*/

-- Create recipients table
CREATE TABLE IF NOT EXISTS recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  default_category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create recipient_rules table
CREATE TABLE IF NOT EXISTS recipient_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text_match text NOT NULL,
  match_type text NOT NULL DEFAULT 'exact' CHECK (match_type IN ('exact', 'contains')),
  amount_match numeric,
  recipient_id uuid NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create budget_plans table
CREATE TABLE IF NOT EXISTS budget_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  amount_planned numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(budget_id, recipient_id, month)
);

-- Add recipient_id to transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'recipient_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN recipient_id uuid REFERENCES recipients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipient_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_plans ENABLE ROW LEVEL SECURITY;

-- Policies for recipients
CREATE POLICY "Anyone can read recipients"
  ON recipients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can insert recipients"
  ON recipients FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update recipients"
  ON recipients FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete recipients"
  ON recipients FOR DELETE
  TO authenticated
  USING (true);

-- Policies for recipient_rules
CREATE POLICY "Anyone can read recipient_rules"
  ON recipient_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can insert recipient_rules"
  ON recipient_rules FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update recipient_rules"
  ON recipient_rules FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete recipient_rules"
  ON recipient_rules FOR DELETE
  TO authenticated
  USING (true);

-- Policies for budget_plans
CREATE POLICY "Anyone can read budget_plans"
  ON budget_plans FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can insert budget_plans"
  ON budget_plans FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update budget_plans"
  ON budget_plans FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete budget_plans"
  ON budget_plans FOR DELETE
  TO authenticated
  USING (true);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_recipients_name ON recipients(name);
CREATE INDEX IF NOT EXISTS idx_recipient_rules_recipient ON recipient_rules(recipient_id);
CREATE INDEX IF NOT EXISTS idx_recipient_rules_priority ON recipient_rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_budget_plans_budget_recipient ON budget_plans(budget_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_budget_plans_month ON budget_plans(month);
CREATE INDEX IF NOT EXISTS idx_transactions_recipient ON transactions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_transactions_budget_date ON transactions(budget_id, date);