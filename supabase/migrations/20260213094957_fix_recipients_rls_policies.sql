/*
  # Fix Recipients RLS Policies for Public Access

  1. Changes
    - Drop existing recipient policies restricted to authenticated users
    - Create new policies allowing public access to match transactions table policies
  
  2. Reason
    - Transactions table allows public access
    - Recipients table was restricted to authenticated users only
    - This mismatch causes update failures when transactions reference recipients
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Anyone can read recipients" ON recipients;
DROP POLICY IF EXISTS "Anyone can insert recipients" ON recipients;
DROP POLICY IF EXISTS "Anyone can update recipients" ON recipients;
DROP POLICY IF EXISTS "Anyone can delete recipients" ON recipients;

-- Create public access policies
CREATE POLICY "Allow public read access to recipients"
  ON recipients FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to recipients"
  ON recipients FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to recipients"
  ON recipients FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to recipients"
  ON recipients FOR DELETE
  TO public
  USING (true);

-- Fix recipient_rules policies
DROP POLICY IF EXISTS "Anyone can read recipient_rules" ON recipient_rules;
DROP POLICY IF EXISTS "Anyone can insert recipient_rules" ON recipient_rules;
DROP POLICY IF EXISTS "Anyone can update recipient_rules" ON recipient_rules;
DROP POLICY IF EXISTS "Anyone can delete recipient_rules" ON recipient_rules;

CREATE POLICY "Allow public read access to recipient_rules"
  ON recipient_rules FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to recipient_rules"
  ON recipient_rules FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to recipient_rules"
  ON recipient_rules FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to recipient_rules"
  ON recipient_rules FOR DELETE
  TO public
  USING (true);

-- Fix budget_plans policies
DROP POLICY IF EXISTS "Anyone can read budget_plans" ON budget_plans;
DROP POLICY IF EXISTS "Anyone can insert budget_plans" ON budget_plans;
DROP POLICY IF EXISTS "Anyone can update budget_plans" ON budget_plans;
DROP POLICY IF EXISTS "Anyone can delete budget_plans" ON budget_plans;

CREATE POLICY "Allow public read access to budget_plans"
  ON budget_plans FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to budget_plans"
  ON budget_plans FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to budget_plans"
  ON budget_plans FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to budget_plans"
  ON budget_plans FOR DELETE
  TO public
  USING (true);