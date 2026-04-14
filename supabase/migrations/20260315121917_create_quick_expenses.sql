/*
  # Create quick_expenses table

  ## Purpose
  Supports the "Hurtig Udgiftsregistrering" (Quick Expense Registration) feature.
  Users can log variable expenses immediately after purchase, and track their
  remaining monthly allowance in real time.

  ## New Tables
  - `quick_expenses`
    - `id` (uuid, PK)
    - `user_id` (uuid, FK → auth.users) — owner of the record
    - `amount` (numeric, NOT NULL) — expense amount in DKK
    - `note` (text, nullable) — optional description
    - `expense_date` (date, default today) — date of the expense
    - `created_at` (timestamptz)

  - `quick_expense_budgets`
    - `id` (uuid, PK)
    - `user_id` (uuid, unique FK → auth.users) — one budget per user
    - `monthly_budget` (numeric, NOT NULL, default 0) — monthly allowance in DKK
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled on both tables
  - Users can only read/write their own records
*/

CREATE TABLE IF NOT EXISTS quick_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  note text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quick_expenses_user_id ON quick_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_quick_expenses_expense_date ON quick_expenses(expense_date);

ALTER TABLE quick_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own quick expenses"
  ON quick_expenses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quick expenses"
  ON quick_expenses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quick expenses"
  ON quick_expenses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own quick expenses"
  ON quick_expenses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Monthly budget allowance per user
CREATE TABLE IF NOT EXISTS quick_expense_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_budget numeric NOT NULL DEFAULT 0 CHECK (monthly_budget >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quick_expense_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own quick expense budget"
  ON quick_expense_budgets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quick expense budget"
  ON quick_expense_budgets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quick expense budget"
  ON quick_expense_budgets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own quick expense budget"
  ON quick_expense_budgets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
